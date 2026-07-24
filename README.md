# gogs-mcp-server

A [Model Context Protocol](https://modelcontextprotocol.io) server for [Gogs](https://gogs.io), packaged to run in Docker. It connects to an **existing** Gogs instance (it does not run Gogs itself) and exposes Gogs operations as MCP tools over Streamable HTTP.

All configuration lives in a single `.env` file.

## Quick start

```bash
cp .env.example .env
```

Edit `.env` and set at least `GOGS_URL` and `GOGS_TOKEN`.

```bash
docker compose up -d --build
```

The MCP server listens on `http://localhost:${MCP_PORT}/mcp` (default `8080`). `MCP_PORT` only controls the port published on the host — the process always binds to port 8080 inside the container.

The container runs as a fixed, unprivileged user/group (see [`Dockerfile`](Dockerfile)). `GOGS_MCP_UID`/`GOGS_MCP_GID` must be set in `.env` (there is no default) and are baked in at build time — rebuild (`docker compose up -d --build`) after changing them.

Logs are written to `./logs/mcp-server.log` on the host (in addition to `docker compose logs`). Docker creates `./logs` automatically on first start, but as `root` — if the container fails to write to it, `chown <uid>:<gid> logs` to match `GOGS_MCP_UID`/`GOGS_MCP_GID`.

## Authentication against Gogs

Create a personal access token via the Gogs web UI under Settings -> Applications (`<GOGS_URL>/user/settings/applications`, reachable even if not linked from a visible menu), or via the API:

```bash
curl -X POST -u YOUR_USERNAME:YOUR_PASSWORD \
  -H "Content-Type: application/json" -d '{"name":"gogs-mcp"}' \
  https://your-gogs-instance/api/v1/users/YOUR_USERNAME/tokens
```

The response's `sha1` field is the token value — set it as `GOGS_TOKEN`.

A Gogs access token inherits the full permissions of whichever account issues it, and every MCP tool call runs as that account with no further restriction. Use a **dedicated, low-privileged account** for this — not an admin — scoped to only the repositories/organizations this integration actually needs.

## Securing the /mcp endpoint

The server itself does not require a Gogs account to be called — anyone who can reach the port can invoke any tool using whatever `GOGS_TOKEN` you configured. Because of that, the server (when run with `MCP_TRANSPORT=http`) **refuses to start** unless one of the two options below is configured. Two options, in order of precedence:

### Option A: OAuth2 (e.g. Keycloak)

Set `OAUTH_ISSUER` to your realm's issuer URL (e.g. `https://keycloak.example.com/realms/myrealm`) and `MCP_PUBLIC_URL` to this server's externally reachable base URL. The server fetches the issuer's `/.well-known/openid-configuration` at startup (crashing loudly if unreachable — a misconfigured issuer should never fail silently), then validates every request's `Authorization: Bearer <token>` as a JWT against the issuer's JWKS. Requests without a valid token get a `401` with a `WWW-Authenticate: Bearer resource_metadata="<MCP_PUBLIC_URL>/.well-known/oauth-protected-resource"` header, which spec-compliant MCP clients use to discover how to authenticate. Set `OAUTH_AUDIENCE` too if you want to also enforce the token's `aud` claim.

See [Configuring Keycloak](#configuring-keycloak) below for how to set up the realm client.

### Option B: shared secret

Simpler, no OIDC provider needed. Set `MCP_AUTH_TOKEN` in `.env` (generate with `openssl rand -hex 32`) to require clients to send `Authorization: Bearer <token>`. Only used when `OAUTH_ISSUER` is empty.

### Running without authentication anyway

If neither is set, the server logs an error and exits rather than starting unauthenticated. To run it unauthenticated anyway — e.g. a deployment that's already network-isolated (no public port, internal Docker network only) — set `MCP_ALLOW_UNAUTHENTICATED=true`.

## Configuring Keycloak

These steps set up a Keycloak client so an MCP client (e.g. Claude.ai's custom connector feature) can obtain access tokens this server accepts.

1. **Create a client** — Realm -> Clients -> Create client.
   - Client ID: any name, e.g. `gogs-mcp-server`
   - Client authentication: **On** (confidential — the MCP host exchanges the auth code for a token server-side and can hold a secret)
   - Authentication flow: **Standard flow** only (leave Direct access grants, Implicit flow, etc. unchecked)

2. **Redirect URI** — depends on which MCP client connects:
   - Claude.ai custom connector: `https://claude.ai/api/mcp/auth_callback` (fixed, documented value)
   - Other/self-hosted MCP clients: whatever loopback or callback URL that client uses — check its docs
   - Set **Web origins** to the same origin (e.g. `https://claude.ai`) if the client needs CORS

3. **PKCE** — under the client's Capability config / Advanced settings, set **PKCE Method** to `S256`. The MCP spec requires PKCE with S256; without this Keycloak may accept a weaker method.

4. **Client scopes** — under the client's **"Client scopes"** tab, make sure every scope listed in this server's `OAUTH_SCOPES` (default `openid offline_access`) is assigned (as Default or Optional). `offline_access` in particular is often *not* assigned by default — Claude requests it automatically whenever the realm advertises it as supported (which Keycloak does by default), and if it isn't assigned to your specific client, Keycloak rejects the whole authorization request with `invalid_scope`.

5. **User role for `offline_access`** — assigning the scope to the *client* (step 4) is not enough on its own. Keycloak also requires the signing-in *user* to hold the realm role `offline_access` (normally part of the `default-roles-<realm>` composite every new user gets automatically). If a user is missing it — e.g. because they were created before that default, or the realm's default roles were customized — the authorization code-to-token exchange fails with reason `Offline tokens not allowed for the user or client`, visible in Realm -> Events. Fix by assigning `offline_access` under Users -> (user) -> Role mapping, or by adding it back to Realm settings -> User registration -> Default roles. Alternatively, drop `offline_access` from `OAUTH_SCOPES` in `.env` entirely if you don't need long-lived refresh tokens — Claude will just re-authenticate more often.

6. **Optional: restrict the token audience** — Client scopes -> add a mapper of type "Audience" targeting this client (or a dedicated audience string), then set the same value as `OAUTH_AUDIENCE` in this server's `.env` so it rejects tokens not intended for it.

7. **Note down**: the Client ID, the Client Secret (Credentials tab), and the realm issuer URL (Realm settings -> General -> the base of the "OpenID Endpoint Configuration" link, i.e. `https://<keycloak-host>/realms/<realm>`). The issuer goes into `OAUTH_ISSUER` in this server's `.env`; the Client ID/Secret go into whatever MCP client you're connecting (this server itself never needs them — it only validates tokens, it doesn't request them).

8. **Optional: Dynamic Client Registration** — if your MCP client supports registering itself automatically instead of a manually-created client, enable client registration for the realm (Realm settings -> Client registration policies, or equivalent for your Keycloak version) and skip steps 1-2 above. Note that a self-registered client won't automatically have `offline_access` (or other non-default scopes) assigned either — the same `invalid_scope` issue from step 4 can still occur.

### Troubleshooting

Symptoms observed in Claude's connector UI are generic (e.g. `oauth_error=invalid_scope`, or `error_code=mcp_token_exchange_failed` with `oauth_error=not_allowed`) — the actual reason is in Keycloak, not in this server. Check Realm -> Events (User events) for the failed attempt:

| Keycloak event reason | Cause | Fix |
|---|---|---|
| (login succeeds, but authorization request is rejected before reaching the login screen or immediately after) | `invalid_scope`: a requested scope isn't assigned to the client | Step 4 above |
| `CODE_TO_TOKEN_ERROR` — "Offline tokens not allowed for the user or client" | The user lacks the `offline_access` realm role | Step 5 above |
| `CODE_TO_TOKEN_ERROR` — other/generic | Client secret mismatch, or redirect URI mismatch between the authorization and token requests | Regenerate the client secret and re-enter it in the MCP client; double check the redirect URI matches exactly |

## Connecting an MCP client

The server speaks [Streamable HTTP](https://modelcontextprotocol.io/docs/concepts/transports) at `POST /mcp`. Point any MCP-compatible client (Claude Code, Claude Desktop via a suitable connector, etc.) at `http://<host>:<MCP_PORT>/mcp`.

For clients that only support spawning a local stdio process instead of HTTP, set `MCP_TRANSPORT=stdio` and run the server directly with `npm start` or `node dist/index.js`, providing `GOGS_URL` and credentials via the environment.

## Available tools

| Tool | Description |
|---|---|
| `gogs_get_current_user` | Get the authenticated user's profile |
| `gogs_search_users` | Search users by name |
| `gogs_list_my_repos` | List repos owned by / accessible to the configured user |
| `gogs_search_repos` | Search repositories |
| `gogs_get_repo` | Get repository details |
| `gogs_create_repo` | Create a new repository |
| `gogs_delete_repo` | Delete a repository (irreversible) |
| `gogs_list_branches` | List branches of a repository |
| `gogs_list_my_orgs` | List organizations the user belongs to |
| `gogs_list_org_repos` | List an organization's repositories |
| `gogs_list_issues` | List issues of a repository |
| `gogs_get_issue` | Get a single issue |
| `gogs_create_issue` | Create an issue |
| `gogs_comment_issue` | Comment on an issue |
| `gogs_list_labels` | List repository labels |
| `gogs_list_milestones` | List repository milestones |
| `gogs_get_file_contents` | Read a file (as plain text) or list a directory at a path |
| `gogs_create_or_update_file` | Create or update a file (creates a commit) |

Gogs' contents API has no endpoint for deleting a single file, so there's no `delete_file` tool.

### Known limitation: repositories with zero commits

Gogs' contents (`gogs_create_or_update_file`) and branches (`gogs_list_branches`) endpoints assume the repository already has at least one commit/branch, and fail with a generic `500` error otherwise - this is a Gogs server-side limitation, not something this server can work around. Always create repositories with `auto_init: true` (the default for `gogs_create_repo`); if you hit this on a repository that was created without an initial commit, push one via `git` directly first.

Reported upstream: [gogs/gogs#8396](https://github.com/gogs/gogs/issues/8396).

## Local development (without Docker)

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run dev` and `npm start` load `.env` automatically via Node's `--env-file` flag.

## License

MIT
