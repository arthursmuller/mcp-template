import { ToolErrorOutput } from "./dtos.js";

export function toolErrorResponse(message: string): ToolErrorOutput | PromiseLike<ToolErrorOutput> {
  return {
    content: [
      {
        type: "text" as const,
        text: `Error listing databases: ${message}`,
      },
    ],
    isError: true,
  };
}

export default toolErrorResponse;