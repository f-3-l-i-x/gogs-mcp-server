import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerUserTools } from "./tools/users.js";
import { registerRepoTools } from "./tools/repos.js";
import { registerIssueTools } from "./tools/issues.js";
import { registerOrgTools } from "./tools/orgs.js";
import { log, logError } from "./logger.js";

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
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
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

  app.get("/mcp", async (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Use POST for stateless requests." },
      id: null,
    });
  });

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.listen(port, () => {
    log(`[gogs-mcp] Streamable HTTP MCP server listening on port ${port} (POST /mcp)`);
  });
}
