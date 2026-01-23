import { ToolSuccessOutput } from "./dtos.js";

export function toolSuccessResponse(data: any): ToolSuccessOutput | PromiseLike<ToolSuccessOutput> {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

export default toolSuccessResponse;