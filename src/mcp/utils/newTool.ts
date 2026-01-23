import { ToolSuccessOutput, ToolErrorOutput } from "./dtos.js";
import toolErrorResponse from "./toolErrorResponse.js";
import toolSuccessResponse from "./toolSuccessResponse.js";

export const newTool = 
  <Fn extends (...args: any[]) => Promise<any>>(fn: Fn) => 
  async (...args: Parameters<Fn>): Promise<ToolSuccessOutput | ToolErrorOutput> => {
    try {
      const data = await fn(...args);
      return toolSuccessResponse(data);
    } catch (error: any) {
      return toolErrorResponse(`Error: ${error?.message ?? String(error)}`);
    }
  };

export default newTool;