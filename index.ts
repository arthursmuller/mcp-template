import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import env from "./src/env.js";
import buildMcpServer from "./src/mcp/utils/buildServer.js";

const server = buildMcpServer();

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${env.SERVER_NAME} MCP Server running on stdio`);
}

main().catch((error: any) => {
  console.error("Fatal error in main loop:", error);
  process.exit(1);
});