import { createRemoteJWKSet, jwtVerify } from "jose";
import { logError } from "./logger.js";

const issuer = process.env.OAUTH_ISSUER;
const audience = process.env.OAUTH_AUDIENCE || undefined;
export const scopes = (process.env.OAUTH_SCOPES ?? "openid offline_access")
  .split(/\s+/)
  .filter(Boolean);

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksUri: string | undefined;

export const oauthEnabled = Boolean(issuer);

async function discoverJwksUri(): Promise<string> {
  const res = await fetch(`${issuer}/.well-known/openid-configuration`);
  if (!res.ok) {
    throw new Error(`Failed to fetch OIDC discovery document: HTTP ${res.status}`);
  }
  const doc = (await res.json()) as { jwks_uri?: string };
  if (!doc.jwks_uri) {
    throw new Error("OIDC discovery document has no jwks_uri");
  }
  return doc.jwks_uri;
}

if (oauthEnabled) {
  jwksUri = await discoverJwksUri();
  jwks = createRemoteJWKSet(new URL(jwksUri));
}

export async function verifyBearerToken(token: string): Promise<boolean> {
  if (!jwks) return false;
  try {
    await jwtVerify(token, jwks, {
      issuer,
      audience,
    });
    return true;
  } catch (err) {
    logError("[gogs-mcp] OAuth token verification failed:", err);
    return false;
  }
}

export function protectedResourceMetadata(resourceUrl: string) {
  return {
    resource: resourceUrl,
    authorization_servers: [issuer],
    scopes_supported: scopes,
  };
}
