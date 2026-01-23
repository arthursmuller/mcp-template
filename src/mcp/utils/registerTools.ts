import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolDefinition } from "./dtos.js";

const registerTools = (toolNames: string[], tools: Record<string, ToolDefinition>, server: McpServer) => {
  toolNames.map((tool) => {
    const {name, description, inputSchema, callback} = tools[tool];
    server.registerTool(name, { description, inputSchema }, callback);
  });
};

export default registerTools;