# gogs-mcp-server

A [Model Context Protocol](https://modelcontextprotocol.io) server for [Gogs](https://gogs.io), packaged to run in Docker. It connects to an **existing** Gogs instance (it does not run Gogs itself) and exposes Gogs operations as MCP tools over Streamable HTTP.

All configuration lives in a single `.env` file.

## Quick start

```bash
cp .env.example .env
```

Edit `.env` and set at least `GOGS_URL` plus either `GOGS_TOKEN` or `GOGS_USERNAME`/`GOGS_PASSWORD`.

```bash
docker compose up -d --build
```

The MCP server listens on `http://localhost:${MCP_PORT}/mcp` (default `8080`). `MCP_PORT` only controls the port published on the host — the process always binds to port 8080 inside the container.

The container runs as a fixed, unprivileged user/group (see [`Dockerfile`](Dockerfile)). `GOGS_MCP_UID`/`GOGS_MCP_GID` must be set in `.env` (there is no default) and are baked in at build time — rebuild (`docker compose up -d --build`) after changing them.

Logs are written to `./logs/mcp-server.log` on the host (in addition to `docker compose logs`). Docker creates `./logs` automatically on first start, but as `root` — if the container fails to write to it, `chown <uid>:<gid> logs` to match `GOGS_MCP_UID`/`GOGS_MCP_GID`.

## Authentication against Gogs

- **Preferred**: create a personal access token via the Gogs API (works regardless of what your web UI exposes) and set `GOGS_TOKEN`:
  ```bash
  curl -X POST -u YOUR_USERNAME:YOUR_PASSWORD \
    -H "Content-Type: application/json" -d '{"name":"gogs-mcp"}' \
    https://your-gogs-instance/api/v1/users/YOUR_USERNAME/tokens
  ```
  The response's `sha1` field is the token value.
- **Fallback**: leave `GOGS_TOKEN` empty and set `GOGS_USERNAME`/`GOGS_PASSWORD`; the server then uses HTTP Basic Auth.

## Securing the /mcp endpoint

The server itself does not require a Gogs account to be called — anyone who can reach the port can invoke any tool using whatever `GOGS_TOKEN`/`GOGS_USERNAME`+`GOGS_PASSWORD` you configured. **Strongly recommended** whenever the server is reachable over a network rather than only via stdio on localhost. Two options, in order of precedence:

### Option A: OAuth2 (e.g. Keycloak)

Set `OAUTH_ISSUER` to your realm's issuer URL (e.g. `https://keycloak.example.com/realms/myrealm`) and `MCP_PUBLIC_URL` to this server's externally reachable base URL. The server fetches the issuer's `/.well-known/openid-configuration` at startup (crashing loudly if unreachable — a misconfigured issuer should never fail silently), then validates every request's `Authorization: Bearer <token>` as a JWT against the issuer's JWKS. Requests without a valid token get a `401` with a `WWW-Authenticate: Bearer resource_metadata="<MCP_PUBLIC_URL>/.well-known/oauth-protected-resource"` header, which spec-compliant MCP clients use to discover how to authenticate. Set `OAUTH_AUDIENCE` too if you want to also enforce the token's `aud` claim.

In Keycloak, you'll need a client for this server (and typically a separate client, or Dynamic Client Registration, for whatever MCP host connects to it) — consult your Keycloak admin for realm-specific conventions (audience mappers, allowed redirect URIs, etc.).

### Option B: shared secret

Simpler, no OIDC provider needed. Set `MCP_AUTH_TOKEN` in `.env` (generate with `openssl rand -hex 32`) to require clients to send `Authorization: Bearer <token>`. Only used when `OAUTH_ISSUER` is empty.

If neither is set, the server logs a warning on startup and accepts unauthenticated requests.

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

## Local development (without Docker)

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run dev` and `npm start` load `.env` automatically via Node's `--env-file` flag.

## License

MIT
