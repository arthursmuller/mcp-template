import z from "zod";
import { ToolDefinition } from "./utils/dtos.js";
import toolMetadata from "../tools.metadata.js";
import buildTool from "./utils/newTool.js";
import DomainService from "../domain/domain-name/services/domain.js";

const tools: Record<string, ToolDefinition> = {
  [toolMetadata.example_tool.name]: {
    name: toolMetadata.example_tool.name,
    description: toolMetadata.example_tool.description,
    inputSchema: {
      exampleParam: z.string().describe(`Example Tool param description`),
    },
    callback: buildTool(DomainService.example)
  },
}

export default tools;