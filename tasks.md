regenerate the eslint boundary rules to, also tell which packages i should add:

"/mcp/tools.ts" can only use from:
"zod";
"./utils/dtos.js";
"../tools.metadata.js";
"./utils/newTool.js";
"./domain/anydomain/services.js"; 



"/domain" cannot use from "../mcp"

"/domain/service" cannot use from "../api/client.ts"