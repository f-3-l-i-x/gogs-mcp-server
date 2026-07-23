import express from "express";
import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerUserTools } from "./tools/users.js";
import { registerRepoTools } from "./tools/repos.js";
import { registerIssueTools } from "./tools/issues.js";
import { registerOrgTools } from "./tools/orgs.js";
import { log, logError } from "./logger.js";
import { oauthEnabled, verifyBearerToken, protectedResourceMetadata, scopes } from "./oauth.js";

function buildServer(): McpServer {
  const server = new McpServer({
    name: "gogs-mcp-server",
    version: "1.0.0",
  });

  registerUserTools(server);
  registerRepoTools(server);
  registerIssueTools(server);
  registerOrgTools(server);

  return server;
}

const transportMode = (process.env.MCP_TRANSPORT ?? "http").toLowerCase();

if (transportMode === "stdio") {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
} else {
  const port = 8080;
  const authToken = process.env.MCP_AUTH_TOKEN;
  const publicUrl = (process.env.MCP_PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/+$/, "");
  const resourceMetadataUrl = `${publicUrl}/.well-known/oauth-protected-resource`;

  const allowUnauthenticated = process.env.MCP_ALLOW_UNAUTHENTICATED === "true";

  if (oauthEnabled) {
    log(`[gogs-mcp] OAuth2 bearer token validation enabled (issuer via OAUTH_ISSUER).`);
  } else if (!authToken) {
    if (!allowUnauthenticated) {
      logError(
        "[gogs-mcp] Refusing to start: none of OAUTH_ISSUER, MCP_AUTH_TOKEN is set, so the " +
          "/mcp endpoint would be reachable by anyone who can reach this port, with no " +
          "authentication, using your configured Gogs credentials. Set one of them, or set " +
          "MCP_ALLOW_UNAUTHENTICATED=true to start anyway (e.g. for a deployment that's " +
          "otherwise network-isolated)."
      );
      process.exit(1);
    }
    logError(
      "[gogs-mcp] Warning: MCP_ALLOW_UNAUTHENTICATED=true - the /mcp endpoint is reachable " +
        "by anyone who can reach this port, without any authentication."
    );
  }

  function unauthorized(res: Response) {
    if (oauthEnabled) {
      res.setHeader(
        "WWW-Authenticate",
        `Bearer resource_metadata="${resourceMetadataUrl}", scope="${scopes.join(" ")}"`
      );
    }
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized" },
      id: null,
    });
  }

  async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const header = req.header("authorization") ?? "";
    const bearerToken = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

    if (oauthEnabled) {
      if (bearerToken && (await verifyBearerToken(bearerToken))) {
        next();
        return;
      }
      unauthorized(res);
      return;
    }

    if (!authToken) {
      next();
      return;
    }

    const expected = `Bearer ${authToken}`;
    const provided = Buffer.from(header);
    const wanted = Buffer.from(expected);
    const authorized =
      provided.length === wanted.length && timingSafeEqual(provided, wanted);

    if (!authorized) {
      unauthorized(res);
      return;
    }

    next();
  }

  const app = express();
  app.use(express.json());

  app.post("/mcp", requireAuth, async (req, res) => {
    try {
      const server = buildServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      res.on("close", () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logError("[gogs-mcp] Error handling MCP request:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  app.get("/mcp", requireAuth, async (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Use POST for stateless requests." },
      id: null,
    });
  });

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  if (oauthEnabled) {
    app.get("/.well-known/oauth-protected-resource", (_req, res) => {
      res.status(200).json(protectedResourceMetadata(`${publicUrl}/mcp`));
    });
  }

  app.listen(port, () => {
    log(`[gogs-mcp] Streamable HTTP MCP server listening on port ${port} (POST /mcp)`);
  });
}
