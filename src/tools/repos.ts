import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { gogsRequest } from "../gogsClient.js";
import { textResult, safe } from "./util.js";

export function registerRepoTools(server: McpServer) {
  server.registerTool(
    "gogs_list_my_repos",
    {
      description: "List repositories owned by or accessible to the configured Gogs user.",
      inputSchema: {},
    },
    safe(async () => {
      const repos = await gogsRequest("GET", "/user/repos");
      return textResult(repos);
    })
  );

  server.registerTool(
    "gogs_search_repos",
    {
      description: "Search public and accessible repositories on the Gogs instance.",
      inputSchema: {
        query: z.string().describe("Search query (repository name)"),
        limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of results"),
      },
    },
    safe(async ({ query, limit }: { query: string; limit: number }) => {
      const result = await gogsRequest(
        "GET",
        `/repos/search?q=${encodeURIComponent(query)}&limit=${limit}`
      );
      return textResult(result);
    })
  );

  server.registerTool(
    "gogs_get_repo",
    {
      description: "Get details of a specific repository.",
      inputSchema: {
        owner: z.string().describe("Repository owner (user or organization)"),
        repo: z.string().describe("Repository name"),
      },
    },
    safe(async ({ owner, repo }: { owner: string; repo: string }) => {
      const result = await gogsRequest("GET", `/repos/${owner}/${repo}`);
      return textResult(result);
    })
  );

  server.registerTool(
    "gogs_create_repo",
    {
      description: "Create a new repository for the configured Gogs user.",
      inputSchema: {
        name: z.string().describe("Repository name"),
        description: z.string().optional().describe("Repository description"),
        private: z.boolean().default(false).describe("Whether the repository is private"),
        auto_init: z.boolean().default(true).describe("Initialize the repository with a README"),
      },
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

  server.registerTool(
    "gogs_delete_repo",
    {
      description: "Permanently delete a repository. This action is irreversible.",
      inputSchema: {
        owner: z.string().describe("Repository owner (user or organization)"),
        repo: z.string().describe("Repository name"),
      },
    },
    safe(async ({ owner, repo }: { owner: string; repo: string }) => {
      await gogsRequest("DELETE", `/repos/${owner}/${repo}`);
      return textResult(`Repository ${owner}/${repo} deleted.`);
    })
  );

  server.registerTool(
    "gogs_list_branches",
    {
      description: "List branches of a repository.",
      inputSchema: {
        owner: z.string().describe("Repository owner (user or organization)"),
        repo: z.string().describe("Repository name"),
      },
    },
    safe(async ({ owner, repo }: { owner: string; repo: string }) => {
      const result = await gogsRequest("GET", `/repos/${owner}/${repo}/branches`);
      return textResult(result);
    })
  );
}
