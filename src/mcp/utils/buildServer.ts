import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import env from "../../env.js";
import registerTools from "./registerTools.js";
import tools from "../tools.js";

const buildMcpServer = () => {
  const server = new McpServer({
    name: env.SERVER_NAME,
    version: "1.0.0",
  });

  registerTools(env.TOOLS_ENABLED, tools, server);

  return server;
}

export default buildMcpServer;