import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export type Principal = { kind: 'user'; email: string } | { kind: 'service'; clientId: string } | { kind: 'dev' };

export type AccessVerifier = (token: string) => Promise<JWTPayload>;

export function normalizeTeamDomain(teamDomain: string): string {
  return teamDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function createAccessVerifier(teamDomain: string, aud: string): AccessVerifier {
  const issuer = `https://${normalizeTeamDomain(teamDomain)}`;
  let jwks = jwksCache.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    jwksCache.set(issuer, jwks);
  }

  return async (token) => (await jwtVerify(token, jwks, { issuer, audience: aud })).payload;
}

// サービストークンの JWT には email がなく、common_name に Client ID が入る
export function principalFromPayload(payload: JWTPayload): Principal | null {
  if (typeof payload.email === 'string' && payload.email !== '') {
    return { kind: 'user', email: payload.email };
  }
  if (typeof payload.common_name === 'string' && payload.common_name !== '') {
    return { kind: 'service', clientId: payload.common_name };
  }
  return null;
}

export function isLocalHost(url: string): boolean {
  const { hostname } = new URL(url);
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}
