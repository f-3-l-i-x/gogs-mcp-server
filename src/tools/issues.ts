import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { gogsRequest } from "../gogsClient.js";
import { textResult, safe } from "./util.js";

export function registerIssueTools(server: McpServer) {
  server.registerTool(
    "gogs_list_issues",
    {
      description: "List issues of a repository.",
      inputSchema: {
        owner: z.string().describe("Repository owner (user or organization)"),
        repo: z.string().describe("Repository name"),
        state: z.enum(["open", "closed"]).default("open").describe("Filter issues by state"),
      },
    },
    safe(async ({ owner, repo, state }: { owner: string; repo: string; state: string }) => {
      const result = await gogsRequest(
        "GET",
        `/repos/${owner}/${repo}/issues?state=${state}`
      );
      return textResult(result);
    })
  );

  server.registerTool(
    "gogs_get_issue",
    {
      description: "Get a single issue by its index.",
      inputSchema: {
        owner: z.string().describe("Repository owner (user or organization)"),
        repo: z.string().describe("Repository name"),
        index: z.number().int().describe("Issue index (number shown in the UI)"),
      },
    },
    safe(async ({ owner, repo, index }: { owner: string; repo: string; index: number }) => {
      const result = await gogsRequest("GET", `/repos/${owner}/${repo}/issues/${index}`);
      return textResult(result);
    })
  );

  server.registerTool(
    "gogs_create_issue",
    {
      description: "Create a new issue in a repository.",
      inputSchema: {
        owner: z.string().describe("Repository owner (user or organization)"),
        repo: z.string().describe("Repository name"),
        title: z.string().describe("Issue title"),
        body: z.string().optional().describe("Issue body/description"),
        labels: z
          .array(z.number().int())
          .optional()
          .describe("List of label IDs to attach to the issue"),
      },
    },
    safe(
      async ({
        owner,
        repo,
        ...rest
      }: {
        owner: string;
        repo: string;
        title: string;
        body?: string;
        labels?: number[];
      }) => {
        const result = await gogsRequest("POST", `/repos/${owner}/${repo}/issues`, rest);
        return textResult(result);
      }
    )
  );

  server.registerTool(
    "gogs_comment_issue",
    {
      description: "Add a comment to an existing issue.",
      inputSchema: {
        owner: z.string().describe("Repository owner (user or organization)"),
        repo: z.string().describe("Repository name"),
        index: z.number().int().describe("Issue index (number shown in the UI)"),
        body: z.string().describe("Comment body"),
      },
    },
    safe(
      async ({
        owner,
        repo,
        index,
        body,
      }: {
        owner: string;
        repo: string;
        index: number;
        body: string;
      }) => {
        const result = await gogsRequest(
          "POST",
          `/repos/${owner}/${repo}/issues/${index}/comments`,
          { body }
        );
        return textResult(result);
      }
    )
  );

  server.registerTool(
    "gogs_list_labels",
    {
      description: "List labels defined on a repository.",
      inputSchema: {
        owner: z.string().describe("Repository owner (user or organization)"),
        repo: z.string().describe("Repository name"),
      },
    },
    safe(async ({ owner, repo }: { owner: string; repo: string }) => {
      const result = await gogsRequest("GET", `/repos/${owner}/${repo}/labels`);
      return textResult(result);
    })
  );

  server.registerTool(
    "gogs_list_milestones",
    {
      description: "List milestones defined on a repository.",
      inputSchema: {
        owner: z.string().describe("Repository owner (user or organization)"),
        repo: z.string().describe("Repository name"),
      },
    },
    safe(async ({ owner, repo }: { owner: string; repo: string }) => {
      const result = await gogsRequest("GET", `/repos/${owner}/${repo}/milestones`);
      return textResult(result);
    })
  );
}
