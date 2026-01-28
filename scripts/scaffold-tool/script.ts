import * as fs from 'fs';
import * as path from 'path';
import { askQuestion, getDomainsServicesWithDomainMap, toPascalCase, toCamelCase, toSnakeCase, logBanner, logEndBanner, DomainInfo, getReadLineInterface } from '../utils.js';

const rl = getReadLineInterface();
  
interface ClientInfo {
  fileName: string;
  className: string;
  absolutePath: string;
}

const endMessage = (selectedDomain: DomainInfo, selectedHttpClient: ClientInfo | null, selectedDbClient: ClientInfo | null, dtoFile: string) => {
  logEndBanner("Tool");
  console.log(`Don't forget to:`);
  console.log(`1. Implement the logic in ${selectedDomain.absolutePath}`);
  if (selectedHttpClient) console.log(`2. Implement client logic in ${selectedHttpClient.fileName}`);
  if (selectedDbClient) console.log(`3. Implement client logic in ${selectedDbClient.fileName}`);
  console.log(`4. Define properties in the new DTO file: ${dtoFile}`);
  console.log(`5. Define the Zod schema in src/mcp/tools.ts`);
}


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

// Helper to inject code into a file
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

async function main() {
  logBanner("MCP New Tool Generator");

  // 1. Gather Data
  const domains = getDomainsServicesWithDomainMap();
  if (domains.length === 0) {
    console.error("[mn] No domains found in src/domain. Please create a domain first.");
    process.exit(1);
  }

  console.log("Available Domain Services:");
  domains.forEach((d, i) => {
    console.log(`  [${i + 1}] ${d.className} (from ${d.dirName})`);
  });

  const selectionIndex = await askQuestion(rl, "\nSelect a Domain Service (number): ");
  const selectedDomain = domains[parseInt(selectionIndex.trim()) - 1];

  if (!selectedDomain) {
    console.error("Invalid selection.");
    process.exit(1);
  }

  const methodNameRaw = (await askQuestion(rl, "New Service Method Name (camelCase, e.g., getWeather): ")).trim();
  const methodName = toCamelCase(methodNameRaw);
  
  const toolNameRaw = (await askQuestion(rl, "Tool Name (snake_case, e.g., get_weather): ")).trim();
  const toolName = toSnakeCase(toolNameRaw);

  const toolDescription = (await askQuestion(rl, "Tool Description: ")).trim();

  // Derived Names
  const requestDtoName = `${toPascalCase(methodName)}RequestDto`;
  const responseDtoName = `${toPascalCase(methodName)}ResponseDto`;

  // --- Client Selection Logic ---
  
  // 1. HTTP Client
  let selectedHttpClient: ClientInfo | null = null;
  let httpClientMethodName: string = "";
  const httpClients =  getClients(selectedDomain.dirName, 'http');
  
  if (httpClients.length > 0) {
    const wantHttp = (await askQuestion(rl, "\nWant to add a http client method? (y/N): ")).trim().toLowerCase();
    if (wantHttp === 'y' || wantHttp === 'yes') {
      if (httpClients.length === 1) {
        selectedHttpClient = httpClients[0];
        console.log(`Selected HTTP Client: ${selectedHttpClient.className}`);
      } else {
        console.log("Available HTTP Clients:");
        httpClients.forEach((c, i) => console.log(`  [${i + 1}] ${c.className} (${c.fileName})`));
        const clientIdx = await askQuestion(rl, "Select HTTP Client (number): ");
        selectedHttpClient = httpClients[parseInt(clientIdx.trim()) - 1];
      }

      if (selectedHttpClient) {
        const methodRaw = (await askQuestion(rl, `HTTP Client Method Name (default: ${methodName}): `)).trim();
        httpClientMethodName = methodRaw ? toCamelCase(methodRaw) : methodName;
      }
    }
  }

  // 2. DB Client
  let selectedDbClient: ClientInfo | null = null;
  let dbClientMethodName: string = "";
  const ybClients = getClients(selectedDomain.dirName, 'db');

  if (ybClients.length > 0) {
    const wantDb = (await askQuestion(rl, "\nWant to add a db client method? (y/N): ")).trim().toLowerCase();
    if (wantDb === 'y' || wantDb === 'yes') {
      if (ybClients.length === 1) {
        selectedDbClient = ybClients[0];
        console.log(`Selected DB Client: ${selectedDbClient.className}`);
      } else {
        console.log("Available DB Clients:");
        ybClients.forEach((c, i) => console.log(`  [${i + 1}] ${c.className} (${c.fileName})`));
        const clientIdx = await askQuestion(rl, "Select DB Client (number): ");
        selectedDbClient = ybClients[parseInt(clientIdx.trim()) - 1];
      }

      if (selectedDbClient) {
        const methodRaw = (await askQuestion(rl, `DB Client Method Name (default: ${methodName}): `)).trim();
        dbClientMethodName = methodRaw ? toCamelCase(methodRaw) : methodName;
      }
    }
  }

  console.log("\n[INFO] Generating tool...\n");

  // 2. Update tools.metadata.ts
  injectIntoFile('src/tools.metadata.ts', (content) => {
    const QtEntry = `
  ${toolName}: {
    name: "${toolName}",
    description: \`${toolDescription}\`,
  },`;
    // Insert before the last closing brace of the object or before "export default"
    return content.replace(/(const toolMetadata = {[\s\S]*?)(\n})/m, `$1${QtEntry}$2`);
  });

  // 3. Update env.ts
  injectIntoFile('src/env.ts', (content) => {
    // Add the tool toggle to TOOLS_ENABLED
    const newToggle = `    process.env.${toolName.toUpperCase()} === "false" ? null : toolMetadata.${toolName}.name,`;
    return content.replace(/(TOOLS_ENABLED:\s*\[[\s\S]*?)(\s*\]\.filter)/, `$1\n${newToggle}$2`);
  });

  // 4. Create DTOs
  const dtoDir = path.join(path.dirname(selectedDomain.absolutePath), '../dtos');
  if (!fs.existsSync(dtoDir)) fs.mkdirSync(dtoDir, { recursive: true });

  const dtoFile = path.join(dtoDir, `${methodName}.dto.ts`);

  fs.writeFileSync(dtoFile, `export interface ${requestDtoName} {\n  // TODO: Add properties\n}\n\nexport interface ${responseDtoName} {\n  // TODO: Add properties\n}\n`);
  console.log(`[CREATE] Created ${dtoFile}`);

  // 5. Update Domain Service (Append Method)
  injectIntoFile(selectedDomain.absolutePath, (content) => {
    // Add imports
    const importStmt = `import { ${requestDtoName}, ${responseDtoName} } from "../dtos/${methodName}.dto.js";\n`;
    let newContent = importStmt + content;

    // Build method body based on selected clients
    let methodBody = `    // TODO: Implement logic\n`;
    
    if (selectedHttpClient) {
      methodBody += `    // Example: const data = await this.httpClient.${httpClientMethodName}(dto);\n`;
      methodBody += `    // return data;\n`;
    } else if (selectedDbClient) {
      methodBody += `    // Example: const data = await this.dbClient.${dbClientMethodName}(dto);\n`;
      methodBody += `    // return data;\n`;
    } 
    
    const methodImpl = `
  async ${methodName}(dto: ${requestDtoName}): Promise<${responseDtoName} | null> {
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

  // 6. Update Clients (Inject Methods)

  // HTTP Client Injection
  if (selectedHttpClient) {
    injectIntoFile(selectedHttpClient.absolutePath, (content) => {
       const importStmt = `import { ${requestDtoName}, ${responseDtoName} } from "../dtos/${methodName}.dto.js";\n`;
       let newContent = importStmt + content;

       const methodImpl = `
  async ${httpClientMethodName}(dto: ${requestDtoName}): Promise<${responseDtoName} | null> {
    // TODO: Implement HTTP Request
    // return this.httpClient.post<${responseDtoName}>("/path", dto);
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
  if (selectedDbClient) {
    injectIntoFile(selectedDbClient.absolutePath, (content) => {
       const importStmt = `import { ${requestDtoName}, ${responseDtoName} } from "../dtos/${methodName}.dto.js";\n`;
       let newContent = importStmt + content;

       const methodImpl = `
  async ${dbClientMethodName}(dto: ${requestDtoName}): Promise<${responseDtoName} | null> {
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

  // 7. Update src/mcp/tools.ts
  injectIntoFile('src/mcp/tools.ts', (content) => {
    let newContent = content;

    // Ensure Domain Service is imported
    if (!newContent.includes(`import ${selectedDomain.className}`)) {
       // Calculate relative path from src/mcp/tools.ts to the service file
       // e.g. ../domain/<dir>/services/<file>.js
       const toolsDir = path.resolve('src/mcp');
       const relativePath = path.relative(toolsDir, selectedDomain.absolutePath);
       
       // Ensure POSIX paths for imports and replace extension
       let importPath = relativePath.split(path.sep).join('/').replace(/\.ts$/, '.js');
       
       // Handle relative path prefix (avoid "./../")
       if (!importPath.startsWith('.')) {
         importPath = `./${importPath}`;
       }
       
       newContent = `import ${selectedDomain.className} from "${importPath}";\n` + newContent;
    }

    // Ensure we define the tool correctly in the existing tools object
    if (!newContent.includes(`import ${selectedDomain.className}`)) {
       // Fallback check if the class name used in import differs (unlikely with this script)
    }

    // Add the tool definition
    const toolDef = `
  [toolMetadata.${toolName}.name]: {
    name: toolMetadata.${toolName}.name,
    description: toolMetadata.${toolName}.description,
    inputSchema: {
      // TODO: Define Zod schema based on ${requestDtoName}
      // param: z.string(),
    },
    callback: buildTool(${selectedDomain.className}.${methodName}).bind(${selectedDomain.className})),
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

  endMessage(selectedDomain, selectedHttpClient, selectedDbClient, dtoFile);
  
  rl.close();
}

main().catch(err => {
  console.error("\n[FATAL ERROR]", err);
  rl.close();
  process.exit(1);
});

