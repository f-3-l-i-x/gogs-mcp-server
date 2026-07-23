import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { gogsRequest } from "../gogsClient.js";
import { textResult, safe } from "./util.js";

export function registerUserTools(server: McpServer) {
  server.tool(
    "gogs_get_current_user",
    "Get the Gogs user profile associated with the configured credentials.",
    {},
    safe(async () => {
      const user = await gogsRequest("GET", "/user");
      return textResult(user);
    })
  );

  server.tool(
    "gogs_search_users",
    "Search for Gogs users by username.",
    {
      query: z.string().describe("Search query (part of username or full name)"),
      limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of results"),
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
