import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { gogsRequest } from "../gogsClient.js";
import { textResult, safe } from "./util.js";

export function registerRepoTools(server: McpServer) {
  server.tool(
    "gogs_list_my_repos",
    "List repositories owned by or accessible to the configured Gogs user.",
    {},
    safe(async () => {
      const repos = await gogsRequest("GET", "/user/repos");
      return textResult(repos);
    })
  );

  server.tool(
    "gogs_search_repos",
    "Search public and accessible repositories on the Gogs instance.",
    {
      query: z.string().describe("Search query (repository name)"),
      limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of results"),
    },
    safe(async ({ query, limit }: { query: string; limit: number }) => {
      const result = await gogsRequest(
        "GET",
        `/repos/search?q=${encodeURIComponent(query)}&limit=${limit}`
      );
      return textResult(result);
    })
  );

  server.tool(
    "gogs_get_repo",
    "Get details of a specific repository.",
    {
      owner: z.string().describe("Repository owner (user or organization)"),
      repo: z.string().describe("Repository name"),
    },
    safe(async ({ owner, repo }: { owner: string; repo: string }) => {
      const result = await gogsRequest("GET", `/repos/${owner}/${repo}`);
      return textResult(result);
    })
  );

  server.tool(
    "gogs_create_repo",
    "Create a new repository for the configured Gogs user.",
    {
      name: z.string().describe("Repository name"),
      description: z.string().optional().describe("Repository description"),
      private: z.boolean().default(false).describe("Whether the repository is private"),
      auto_init: z.boolean().default(true).describe("Initialize the repository with a README"),
    },
    safe(
      async (args: {
        name: string;
        description?: string;
        private: boolean;
        auto_init: boolean;
      }) => {
        const result = await gogsRequest("POST", "/user/repos", args);
        return textResult(result);
      }
    )
  );

  server.tool(
    "gogs_delete_repo",
    "Permanently delete a repository. This action is irreversible.",
    {
      owner: z.string().describe("Repository owner (user or organization)"),
      repo: z.string().describe("Repository name"),
    },
    safe(async ({ owner, repo }: { owner: string; repo: string }) => {
      await gogsRequest("DELETE", `/repos/${owner}/${repo}`);
      return textResult(`Repository ${owner}/${repo} deleted.`);
    })
  );

  server.tool(
    "gogs_list_branches",
    "List branches of a repository.",
    {
      owner: z.string().describe("Repository owner (user or organization)"),
      repo: z.string().describe("Repository name"),
    },
    safe(async ({ owner, repo }: { owner: string; repo: string }) => {
      const result = await gogsRequest("GET", `/repos/${owner}/${repo}/branches`);
      return textResult(result);
    })
  );
}
