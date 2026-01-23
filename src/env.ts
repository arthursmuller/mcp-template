import toolMetadata from "./tools.metadata.js";

const env = {
  SERVER_NAME: "example-mcp-proj-name",
  TOOLS_ENABLED: [
    process.env.EXAMPLE_TOOL === "true" ? toolMetadata.example_tool.name : null,
  ].filter(element => element !== null),
  API: {
    Url: (() : string => {
      if (!process.env.API_URL) {
        throw new Error("API_URL environment variable is not defined");
      }

      return process.env.API_URL.replace(/\/$/, "") ?? "";
    })(),
    headers: {
      Example: process.env.EXAMPLE_HEADER || "",
    }
  }
}

export default env;