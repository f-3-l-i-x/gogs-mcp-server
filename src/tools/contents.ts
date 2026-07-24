import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { gogsRequest } from "../gogsClient.js";
import { textResult, safe, withEmptyRepoHint } from "./util.js";

function encodePath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

function decodeFileContent(entry: unknown): unknown {
  if (
    entry &&
    typeof entry === "object" &&
    "encoding" in entry &&
    (entry as { encoding?: string }).encoding === "base64" &&
    "content" in entry
  ) {
    const { content, ...rest } = entry as { content: string; encoding: string };
    return { ...rest, content: Buffer.from(content, "base64").toString("utf-8") };
  }
  return entry;
}

export function registerContentsTools(server: McpServer) {
  server.registerTool(
    "gogs_get_file_contents",
    {
      description:
        "Read a file or list a directory's contents at a given path in a repository. " +
        "File content is decoded to plain text.",
      inputSchema: {
        owner: z.string().describe("Repository owner (user or organization)"),
        repo: z.string().describe("Repository name"),
        path: z
          .string()
          .default("")
          .describe("Path within the repository (empty string for the repository root)"),
        ref: z
          .string()
          .optional()
          .describe("Branch, tag, or commit SHA to read from (defaults to the default branch)"),
      },
    },
    safe(
      async ({
        owner,
        repo,
        path,
        ref,
      }: {
        owner: string;
        repo: string;
        path: string;
        ref?: string;
      }) => {
        const encodedPath = encodePath(path);
        const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
        const result = await gogsRequest(
          "GET",
          `/repos/${owner}/${repo}/contents${encodedPath ? `/${encodedPath}` : ""}${query}`
        );
        const decoded = Array.isArray(result) ? result.map(decodeFileContent) : decodeFileContent(result);
        return textResult(decoded);
      }
    )
  );

  server.registerTool(
    "gogs_create_or_update_file",
    {
      description:
        "Create or update a file in a repository. This creates a real commit on the " +
        "target branch.",
      inputSchema: {
        owner: z.string().describe("Repository owner (user or organization)"),
        repo: z.string().describe("Repository name"),
        path: z.string().describe("File path within the repository"),
        content: z.string().describe("New file content (plain text)"),
        message: z.string().describe("Commit message"),
        branch: z
          .string()
          .optional()
          .describe("Branch to commit to (defaults to the repository's default branch)"),
      },
    },
    safe(
      async ({
        owner,
        repo,
        path,
        content,
        message,
        branch,
      }: {
        owner: string;
        repo: string;
        path: string;
        content: string;
        message: string;
        branch?: string;
      }) => {
        const encodedPath = encodePath(path);
        const result = await withEmptyRepoHint(() =>
          gogsRequest("PUT", `/repos/${owner}/${repo}/contents/${encodedPath}`, {
            message,
            content: Buffer.from(content, "utf-8").toString("base64"),
            ...(branch ? { branch } : {}),
          })
        );
        return textResult(result);
      }
    )
  );
}
