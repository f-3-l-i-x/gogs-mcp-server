import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { gogsRequest } from "../gogsClient.js";
import { textResult, safe } from "./util.js";

export function registerUserTools(server: McpServer) {
  server.registerTool(
    "gogs_get_current_user",
    {
      description: "Get the Gogs user profile associated with the configured credentials.",
      inputSchema: {},
    },
    safe(async () => {
      const user = await gogsRequest("GET", "/user");
      return textResult(user);
    })
  );

  server.registerTool(
    "gogs_search_users",
    {
      description: "Search for Gogs users by username.",
      inputSchema: {
        query: z.string().describe("Search query (part of username or full name)"),
        limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of results"),
      },
    },
    safe(async ({ query, limit }: { query: string; limit: number }) => {
      const result = await gogsRequest(
        "GET",
        `/users/search?q=${encodeURIComponent(query)}&limit=${limit}`
      );
      return textResult(result);
    })
  );
}
