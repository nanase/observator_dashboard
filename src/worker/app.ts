import { Hono } from 'hono';
import type { LatestResponse } from '../shared/api';
import { createAccessVerifier, isLocalHost, principalFromPayload, type AccessVerifier, type Principal } from './auth';
import { countPendingDevices, listDevices, parseDevicePatch, updateDevice } from './devices';
import { ingest, parseIngestRequest } from './ingest';
import { parseSeriesQuery, querySeries } from './series';
import { nowSeconds } from './time';

export interface AppOptions {
  // テストで JWKS の取得先を差し替えるためのフック
  createVerifier?: (env: Env) => AccessVerifier | null;
}

type AppEnv = { Bindings: Env; Variables: { principal: Principal } };

function defaultVerifier(env: Env): AccessVerifier | null {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  return createAccessVerifier(env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function createApp(options: AppOptions = {}) {
  const createVerifier = options.createVerifier ?? defaultVerifier;
  const app = new Hono<AppEnv>().basePath('/api');

  app.use('*', async (c, next) => {
    if (c.env.DEV_AUTH_EMAIL && isLocalHost(c.req.url)) {
      c.set('principal', { kind: 'dev' });
      return next();
    }

    const verifier = createVerifier(c.env);
    if (verifier === null) {
      // 設定漏れのまま公開されても素通りさせない
      console.error('Access verification is not configured');
      return c.json({ error: 'server misconfigured' }, 500);
    }

    const token = c.req.header('Cf-Access-Jwt-Assertion');
    if (!token) return c.json({ error: 'unauthorized' }, 401);

    let principal: Principal | null;
    try {
      principal = principalFromPayload(await verifier(token));
    } catch {
      return c.json({ error: 'unauthorized' }, 401);
    }
    if (principal === null) return c.json({ error: 'unauthorized' }, 401);

    const isIngest = c.req.path === '/api/ingest';
    const allowed = isIngest
      ? principal.kind === 'service' && !!c.env.INGEST_CLIENT_ID && principal.clientId === c.env.INGEST_CLIENT_ID
      : principal.kind === 'user';
    if (!allowed) return c.json({ error: 'forbidden' }, 403);

    c.set('principal', principal);
    return next();
  });

  app.post('/ingest', async (c) => {
    const now = nowSeconds();
    const parsed = parseIngestRequest(await readJson(c.req.raw), now);
    if (typeof parsed === 'string') return c.json({ error: parsed }, 400);
    return c.json(await ingest(c.env.DB, parsed, now));
  });

  app.get('/latest', async (c) => {
    const [devices, pendingCount] = await Promise.all([listDevices(c.env.DB, 'active'), countPendingDevices(c.env.DB)]);
    return c.json<LatestResponse>({ now: nowSeconds(), pendingCount, devices });
  });

  app.get('/series', async (c) => {
    const query = parseSeriesQuery(new URL(c.req.url).searchParams);
    if (typeof query === 'string') return c.json({ error: query }, 400);
    return c.json(await querySeries(c.env.DB, query, nowSeconds()));
  });

  app.get('/devices', async (c) => c.json({ devices: await listDevices(c.env.DB) }));

  app.patch('/devices/:id{[0-9]+}', async (c) => {
    const patch = parseDevicePatch(await readJson(c.req.raw));
    if (typeof patch === 'string') return c.json({ error: patch }, 400);

    const device = await updateDevice(c.env.DB, Number(c.req.param('id')), patch, nowSeconds());
    return device === null ? c.json({ error: 'not found' }, 404) : c.json(device);
  });

  app.notFound((c) => c.json({ error: 'not found' }, 404));
  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: 'internal error' }, 500);
  });

  return app;
}
