import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { gogsRequest } from "../gogsClient.js";
import { textResult, safe } from "./util.js";

export function registerOrgTools(server: McpServer) {
  server.registerTool(
    "gogs_list_my_orgs",
    {
      description: "List organizations the configured Gogs user belongs to.",
      inputSchema: {},
    },
    safe(async () => {
      const result = await gogsRequest("GET", "/user/orgs");
      return textResult(result);
    })
  );

  server.registerTool(
    "gogs_list_org_repos",
    {
      description: "List repositories owned by an organization.",
      inputSchema: {
        org: z.string().describe("Organization name"),
      },
    },
    safe(async ({ org }: { org: string }) => {
      const result = await gogsRequest("GET", `/orgs/${org}/repos`);
      return textResult(result);
    })
  );
}
