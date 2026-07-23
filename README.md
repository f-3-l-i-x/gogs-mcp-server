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

The MCP server listens on `http://localhost:${MCP_PORT}/mcp` (default `8080`).

The container runs as an a fixed, unprivileged user/group (see `Dockerfile`).

## Authentication against Gogs

- **Preferred**: create a personal access token in Gogs under *Settings → Applications* and set `GOGS_TOKEN`.
- **Fallback**: leave `GOGS_TOKEN` empty and set `GOGS_USERNAME`/`GOGS_PASSWORD`; the server then uses HTTP Basic Auth.

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
