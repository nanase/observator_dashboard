import { env } from 'cloudflare:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, SignJWT, type JWTPayload } from 'jose';
import { createApp } from '../src/worker/app';

export const TEAM_DOMAIN = 'test.cloudflareaccess.com';
export const AUD = 'test-aud';
export const INGEST_CLIENT_ID = 'central.access';
export const CENTRAL = 'aa:bb:cc:dd:ee:ff';

const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'test', alg: 'RS256' }] });

export const app = createApp({
  createVerifier: (e) =>
    e.ACCESS_TEAM_DOMAIN && e.ACCESS_AUD
      ? async (token) =>
          (await jwtVerify(token, jwks, { issuer: `https://${e.ACCESS_TEAM_DOMAIN}`, audience: e.ACCESS_AUD })).payload
      : null,
});

export const testEnv: Env = {
  ...env,
  DEV_AUTH_EMAIL: '',
  ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
  ACCESS_AUD: AUD,
  INGEST_CLIENT_ID,
};

export async function sign(claims: JWTPayload, audience = AUD): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test' })
    .setIssuer(`https://${TEAM_DOMAIN}`)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

export const userToken = () => sign({ email: 'owner@example.com', sub: 'user' });
export const serviceToken = (clientId = INGEST_CLIENT_ID) => sign({ common_name: clientId, sub: '' });

export async function request(
  path: string,
  init: { method?: string; body?: unknown; token?: string; env?: Env; host?: string } = {},
): Promise<Response> {
  const headers = new Headers();
  if (init.token !== undefined) headers.set('Cf-Access-Jwt-Assertion', init.token);
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');

  return app.fetch(
    new Request(`https://${init.host ?? 'observator.example.com'}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
    init.env ?? testEnv,
  );
}

export async function asUser(path: string, init: { method?: string; body?: unknown } = {}): Promise<Response> {
  return request(path, { ...init, token: await userToken() });
}

export async function postIngest(body: unknown): Promise<Response> {
  return request('/api/ingest', { method: 'POST', body, token: await serviceToken() });
}

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export async function resetDatabase(): Promise<void> {
  await env.DB.batch(
    ['devices', 'readings_1m', 'readings_10m', 'readings_1d', 'rollup_queue'].map((table) =>
      env.DB.prepare(`DELETE FROM ${table}`),
    ),
  );
}
