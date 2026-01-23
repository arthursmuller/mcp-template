import z from "zod";

export type ToolSuccessOutput = {
  content: {
    text: string,
    type: "text"
  }[],
};

export type ToolErrorOutput = ToolSuccessOutput & {
  isError?: boolean
};

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  callback: (dto: any) => Promise<ToolSuccessOutput | ToolErrorOutput>;
}