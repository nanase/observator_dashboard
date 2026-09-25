import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/worker/app';
import { normalizeTeamDomain } from '../src/worker/auth';
import { request, resetDatabase, serviceToken, sign, testEnv, userToken } from './helpers';

beforeEach(resetDatabase);

describe('Access の JWT 検証', () => {
  it('JWT がなければ 401 を返す', async () => {
    expect((await request('/api/latest')).status).toBe(401);
  });

  it('署名が不正なら 401 を返す', async () => {
    expect((await request('/api/latest', { token: 'not-a-jwt' })).status).toBe(401);
  });

  it('aud が異なれば 401 を返す', async () => {
    const token = await sign({ email: 'owner@example.com' }, 'other-aud');
    expect((await request('/api/latest', { token })).status).toBe(401);
  });

  it('本人の JWT で参照系 API を使える', async () => {
    expect((await request('/api/latest', { token: await userToken() })).status).toBe(200);
  });

  it('本人の JWT では ingest を使えない', async () => {
    const response = await request('/api/ingest', { method: 'POST', body: {}, token: await userToken() });
    expect(response.status).toBe(403);
  });

  it('サービストークンでは参照系 API を使えない', async () => {
    expect((await request('/api/latest', { token: await serviceToken() })).status).toBe(403);
  });

  it('Client ID が異なるサービストークンでは ingest を使えない', async () => {
    const response = await request('/api/ingest', {
      method: 'POST',
      body: {},
      token: await serviceToken('other.access'),
    });
    expect(response.status).toBe(403);
  });

  it('INGEST_CLIENT_ID が未設定なら ingest を拒否する', async () => {
    const response = await request('/api/ingest', {
      method: 'POST',
      body: {},
      token: await serviceToken(),
      env: { ...testEnv, INGEST_CLIENT_ID: '' },
    });
    expect(response.status).toBe(403);
  });

  it('Access の設定がなければ 500 を返して素通りさせない', async () => {
    const response = await createApp().fetch(new Request('https://observator.example.com/api/latest'), {
      ...env,
      DEV_AUTH_EMAIL: '',
      ACCESS_TEAM_DOMAIN: '',
      ACCESS_AUD: '',
    });
    expect(response.status).toBe(500);
  });
});

describe('開発用の認証省略', () => {
  const devEnv = { ...testEnv, DEV_AUTH_EMAIL: 'dev@example.com' };

  it('localhost なら JWT なしで通す', async () => {
    expect((await request('/api/latest', { env: devEnv, host: 'localhost:5173' })).status).toBe(200);
  });

  it('localhost 以外では省略しない', async () => {
    expect((await request('/api/latest', { env: devEnv })).status).toBe(401);
  });
});

describe('normalizeTeamDomain', () => {
  it('スキームと末尾のスラッシュを落とす', () => {
    expect(normalizeTeamDomain('https://team.cloudflareaccess.com/')).toBe('team.cloudflareaccess.com');
    expect(normalizeTeamDomain('team.cloudflareaccess.com')).toBe('team.cloudflareaccess.com');
  });
});
