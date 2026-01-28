import * as fs from 'fs';
import * as path from 'path';
import { 
  askQuestion, 
  getDomainsServicesWithDomainMap, 
  toPascalCase, 
  toCamelCase, 
  toSnakeCase, 
  logEndBanner, 
  DomainInfo, 
  getReadLineInterface,
  execute 
} from '../utils.js';

const rl = getReadLineInterface();

// --- Types ---

interface ClientInfo {
  fileName: string;
  className: string;
  absolutePath: string;
}

interface RawInputs {
  domain: DomainInfo;
  methodNameRaw: string;
  toolNameRaw: string;
  toolDescription: string;
  httpClientSelection: { client: ClientInfo | null; methodName: string };
  dbClientSelection: { client: ClientInfo | null; methodName: string };
}

interface ToolConfig {
  domain: DomainInfo;
  methodName: string;
  toolName: string;
  toolDescription: string;
  
  // Derived Names
  requestDtoName: string;
  responseDtoName: string;
  dtoFile: string;

  // Clients
  httpClient: ClientInfo | null;
  httpClientMethodName: string;
  dbClient: ClientInfo | null;
  dbClientMethodName: string;
}

// --- Helpers ---

const getClients = (domainDirName: string, type: 'http' | 'db'): ClientInfo[] => {
  const clientsDir = path.resolve('src/domain', domainDirName, 'clients');
  if (!fs.existsSync(clientsDir)) return [];

  const clients: ClientInfo[] = [];
  const files = fs.readdirSync(clientsDir);
  const suffix = type === 'http' ? '.http.client.ts' : '.db.client.ts';

  for (const file of files) {
    if (file.endsWith(suffix)) {
      const clientPath = path.join(clientsDir, file);
      const content = fs.readFileSync(clientPath, 'utf8');
      const match = content.match(/export\s+class\s+(\w+)/);
      if (match && match[1]) {
        clients.push({
          fileName: file,
          className: match[1],
          absolutePath: clientPath
        });
      }
    }
  }
  return clients;
};

const injectIntoFile = (filePath: string, injector: (content: string) => string) => {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`[ERROR] File not found: ${filePath}`);
    return;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  const newContent = injector(content);
  if (content !== newContent) {
    fs.writeFileSync(fullPath, newContent, 'utf8');
    console.log(`[UPDATE] Modified ${filePath}`);
  } else {
    console.log(`[QK] No changes made to ${filePath} (pattern might not match)`);
  }
};

// --- Execution Steps ---

const loadInputs = async (): Promise<RawInputs> => {
  // 1. Select Domain
  const domains = getDomainsServicesWithDomainMap();
  if (domains.length === 0) {
    throw new Error("[mn] No domains found in src/domain. Please create a domain first.");
  }

  console.log("Available Domain Services:");
  domains.forEach((d, i) => {
    console.log(`  [${i + 1}] ${d.className} (from ${d.dirName})`);
  });

  const selectionIndex = await askQuestion(rl, "\nSelect a Domain Service (number): ");
  const selectedDomain = domains[parseInt(selectionIndex.trim()) - 1];

  if (!selectedDomain) {
    throw new Error("Invalid selection.");
  }

  // 2. Tool Details
  const methodNameRaw = (await askQuestion(rl, "New Service Method Name (camelCase, e.g., getWeather): ")).trim();
  const toolNameRaw = (await askQuestion(rl, "Tool Name (snake_case, e.g., get_weather): ")).trim();
  const toolDescription = (await askQuestion(rl, "Tool Description: ")).trim();

  // 3. Client Selection Logic (HTTP)
  let httpClient: ClientInfo | null = null;
  let httpClientMethodName = "";
  const httpClients = getClients(selectedDomain.dirName, 'http');

  if (httpClients.length > 0) {
    const wantHttp = (await askQuestion(rl, "\nWant to add a http client method? (y/N): ")).trim().toLowerCase();
    if (wantHttp === 'y' || wantHttp === 'yes') {
      if (httpClients.length === 1) {
        httpClient = httpClients[0];
        console.log(`Selected HTTP Client: ${httpClient.className}`);
      } else {
        console.log("Available HTTP Clients:");
        httpClients.forEach((c, i) => console.log(`  [${i + 1}] ${c.className} (${c.fileName})`));
        const clientIdx = await askQuestion(rl, "Select HTTP Client (number): ");
        httpClient = httpClients[parseInt(clientIdx.trim()) - 1];
      }

      if (httpClient) {
        const methodRaw = (await askQuestion(rl, `HTTP Client Method Name (default: ${toCamelCase(methodNameRaw)}): `)).trim();
        httpClientMethodName = methodRaw || methodNameRaw;
      }
    }
  }

  // 4. Client Selection Logic (DB)
  let dbClient: ClientInfo | null = null;
  let dbClientMethodName = "";
  const dbClients = getClients(selectedDomain.dirName, 'db');

  if (dbClients.length > 0) {
    const wantDb = (await askQuestion(rl, "\nWant to add a db client method? (y/N): ")).trim().toLowerCase();
    if (wantDb === 'y' || wantDb === 'yes') {
      if (dbClients.length === 1) {
        dbClient = dbClients[0];
        console.log(`Selected DB Client: ${dbClient.className}`);
      } else {
        console.log("Available DB Clients:");
        dbClients.forEach((c, i) => console.log(`  [${i + 1}] ${c.className} (${c.fileName})`));
        const clientIdx = await askQuestion(rl, "Select DB Client (number): ");
        dbClient = dbClients[parseInt(clientIdx.trim()) - 1];
      }

      if (dbClient) {
        const methodRaw = (await askQuestion(rl, `DB Client Method Name (default: ${toCamelCase(methodNameRaw)}): `)).trim();
        dbClientMethodName = methodRaw || methodNameRaw;
      }
    }
  }

  return {
    domain: selectedDomain,
    methodNameRaw,
    toolNameRaw,
    toolDescription,
    httpClientSelection: { client: httpClient, methodName: httpClientMethodName },
    dbClientSelection: { client: dbClient, methodName: dbClientMethodName }
  };
};

const transformInputs = (inputs: RawInputs): ToolConfig => {
  const methodName = toCamelCase(inputs.methodNameRaw);
  const toolName = toSnakeCase(inputs.toolNameRaw);
  const dtoDir = path.join(path.dirname(inputs.domain.absolutePath), '../dtos');
  
  return {
    domain: inputs.domain,
    methodName,
    toolName,
    toolDescription: inputs.toolDescription,
    
    requestDtoName: `${toPascalCase(methodName)}RequestDto`,
    responseDtoName: `${toPascalCase(methodName)}ResponseDto`,
    dtoFile: path.join(dtoDir, `${methodName}.dto.ts`),

    httpClient: inputs.httpClientSelection.client,
    httpClientMethodName: toCamelCase(inputs.httpClientSelection.methodName),
    
    dbClient: inputs.dbClientSelection.client,
    dbClientMethodName: toCamelCase(inputs.dbClientSelection.methodName),
  };
};

// --- Generators ---

const updateMetadata = (config: ToolConfig) => {
  injectIntoFile('src/tools.metadata.ts', (content) => {
    const QtEntry = `
  ${config.toolName}: {
    name: "${config.toolName}",
    description: \`${config.toolDescription}\`,
  },`;
    // Insert before the last closing brace of the object or before "export default"
    return content.replace(/(const toolMetadata = {[\s\S]*?)(\n})/m, `$1${QtEntry}$2`);
  });
};

const updateEnv = (config: ToolConfig) => {
  injectIntoFile('src/env.ts', (content) => {
    const newToggle = `    process.env.${config.toolName.toUpperCase()} === "false" ? null : toolMetadata.${config.toolName}.name,`;
    return content.replace(/(TOOLS_ENABLED:\s*\[[\s\S]*?)(\s*\]\.filter)/, `$1\n${newToggle}$2`);
  });
};

const createDtoFile = (config: ToolConfig) => {
  if (!fs.existsSync(path.dirname(config.dtoFile))) {
    fs.mkdirSync(path.dirname(config.dtoFile), { recursive: true });
  }

  const content = `export interface ${config.requestDtoName} {\n  // TODO: Add properties\n}\n\nexport interface ${config.responseDtoName} {\n  // TODO: Add properties\n}\n`;
  fs.writeFileSync(config.dtoFile, content);
  console.log(`[CREATE] Created ${config.dtoFile}`);
};

const updateDomainService = (config: ToolConfig) => {
  injectIntoFile(config.domain.absolutePath, (content) => {
    // Add imports
    const importStmt = `import { ${config.requestDtoName}, ${config.responseDtoName} } from "../dtos/${config.methodName}.dto.js";\n`;
    let newContent = importStmt + content;

    // Build method body based on selected clients
    let methodBody = `    // TODO: Implement logic\n`;
    
    if (config.httpClient) {
      methodBody += `    // Example: const data = await this.httpClient.${config.httpClientMethodName}(dto);\n`;
      methodBody += `    // return data;\n`;
    } else if (config.dbClient) {
      methodBody += `    // Example: const data = await this.dbClient.${config.dbClientMethodName}(dto);\n`;
      methodBody += `    // return data;\n`;
    } 
    
    const methodImpl = `
  async ${config.methodName}(dto: ${config.requestDtoName}): Promise<${config.responseDtoName} | null> {
${methodBody}
    return null;
  }
`;
    // Locate the closing brace of the class. 
    const lastBraceIndex = newContent.lastIndexOf('}');
    if (lastBraceIndex !== -1) {
      newContent = newContent.slice(0, lastBraceIndex) + methodImpl + newContent.slice(lastBraceIndex);
    }
    
    return newContent;
  });
};

const updateClients = (config: ToolConfig) => {
  // HTTP Client Injection
  if (config.httpClient) {
    injectIntoFile(config.httpClient.absolutePath, (content) => {
       const importStmt = `import { ${config.requestDtoName}, ${config.responseDtoName} } from "../dtos/${config.methodName}.dto.js";\n`;
       let newContent = importStmt + content;

       const methodImpl = `
  async ${config.httpClientMethodName}(dto: ${config.requestDtoName}): Promise<${config.responseDtoName} | null> {
    // TODO: Implement HTTP Request
    // return this.httpClient.post<${config.responseDtoName}>("/path", dto);
    return null;
  }
`;
       const lastBraceIndex = newContent.lastIndexOf('}');
       if (lastBraceIndex !== -1) {
         newContent = newContent.slice(0, lastBraceIndex) + methodImpl + newContent.slice(lastBraceIndex);
       }
       return newContent;
    });
  }

  // DB Client Injection
  if (config.dbClient) {
    injectIntoFile(config.dbClient.absolutePath, (content) => {
       const importStmt = `import { ${config.requestDtoName}, ${config.responseDtoName} } from "../dtos/${config.methodName}.dto.js";\n`;
       let newContent = importStmt + content;

       const methodImpl = `
  async ${config.dbClientMethodName}(dto: ${config.requestDtoName}): Promise<${config.responseDtoName} | null> {
    // TODO: Implement DB Operation
    return null;
  }
`;
       const lastBraceIndex = newContent.lastIndexOf('}');
       if (lastBraceIndex !== -1) {
         newContent = newContent.slice(0, lastBraceIndex) + methodImpl + newContent.slice(lastBraceIndex);
       }
       return newContent;
    });
  }
};

const updateMcpRegistry = (config: ToolConfig) => {
  injectIntoFile('src/mcp/tools.ts', (content) => {
    let newContent = content;

    // Ensure Domain Service is imported
    if (!newContent.includes(`import ${config.domain.className}`)) {
       // Calculate relative path from src/mcp/tools.ts to the service file
       const toolsDir = path.resolve('src/mcp');
       const relativePath = path.relative(toolsDir, config.domain.absolutePath);
       
       // Ensure POSIX paths for imports and replace extension
       let importPath = relativePath.split(path.sep).join('/').replace(/\.ts$/, '.js');
       
       // Handle relative path prefix (avoid "./../")
       if (!importPath.startsWith('.')) {
         importPath = `./${importPath}`;
       }
       
       newContent = `import ${config.domain.className} from "${importPath}";\n` + newContent;
    }

    // Add the tool definition
    const toolDef = `
  [toolMetadata.${config.toolName}.name]: {
    name: toolMetadata.${config.toolName}.name,
    description: toolMetadata.${config.toolName}.description,
    inputSchema: {
      // TODO: Define Zod schema based on ${config.requestDtoName}
      // param: z.string(),
    },
    callback: buildTool(${config.domain.className}.${config.methodName}.bind(${config.domain.className})),
  },`;

    // Regex to capture the tools object content and append the new tool
    newContent = newContent.replace(
      /(const tools: Record<string, ToolDefinition> = {[\s\S]*?)(\n})/m, 
      (match, p1, p2) => {
        let modifiedContent = p1;
        const lastBraceIndex = modifiedContent.lastIndexOf('}');
        
        // Add a comma if the previous entry didn't have one
        if (lastBraceIndex !== -1 && lastBraceIndex > modifiedContent.indexOf('{')) {
             const contentAfterBrace = modifiedContent.slice(lastBraceIndex + 1);
             if (!contentAfterBrace.trim().startsWith(',')) {
                 modifiedContent = 
                    modifiedContent.slice(0, lastBraceIndex + 1) + 
                    ',' + 
                    modifiedContent.slice(lastBraceIndex + 1);
             }
        }
        return `${modifiedContent}${toolDef}${p2}`;
      }
    );

    return newContent;
  });
};

const showNextSteps = (config: ToolConfig) => {
  logEndBanner("Tool");
  console.log(`Don't forget to:`);
  console.log(`1. Implement the logic in ${config.domain.absolutePath}`);
  if (config.httpClient) console.log(`2. Implement client logic in ${config.httpClient.fileName}`);
  if (config.dbClient) console.log(`3. Implement client logic in ${config.dbClient.fileName}`);
  console.log(`4. Define properties in the new DTO file: ${config.dtoFile}`);
  console.log(`5. Define the Zod schema in src/mcp/tools.ts`);
};

// --- Main Execution ---

execute(rl, "MCP New Tool Generator", async () => {
  const inputs = await loadInputs();
  const config = transformInputs(inputs);

  console.log("\n[INFO] Generating tool...\n");

  updateMetadata(config);
  updateEnv(config);
  createDtoFile(config);
  updateDomainService(config);
  updateClients(config);
  updateMcpRegistry(config);
  
  showNextSteps(config);
});