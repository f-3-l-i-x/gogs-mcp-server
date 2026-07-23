import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { gogsRequest } from "../gogsClient.js";
import { textResult, safe } from "./util.js";

export function registerOrgTools(server: McpServer) {
  server.tool(
    "gogs_list_my_orgs",
    "List organizations the configured Gogs user belongs to.",
    {},
    safe(async () => {
      const result = await gogsRequest("GET", "/user/orgs");
      return textResult(result);
    })
  );

  server.tool(
    "gogs_list_org_repos",
    "List repositories owned by an organization.",
    {
      org: z.string().describe("Organization name"),
    },
    safe(async ({ org }: { org: string }) => {
      const result = await gogsRequest("GET", `/orgs/${org}/repos`);
      return textResult(result);
    })
  );
}
