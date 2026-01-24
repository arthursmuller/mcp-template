import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// --- Configuration ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

// --- Helpers ---
const toPascalCase = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

interface DomainInfo {
  dirName: string;
  className: string;
  absolutePath: string;
}

const getDomains = (): DomainInfo[] => {
  const domainsDir = path.resolve('src/domain');
  if (!fs.existsSync(domainsDir)) return [];

  const domains: DomainInfo[] = [];
  const entries = fs.readdirSync(domainsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      // Support new structure: src/domain/<name>/services/<file>.ts
      const servicesDir = path.join(domainsDir, entry.name, 'services');
      
      if (fs.existsSync(servicesDir) && fs.statSync(servicesDir).isDirectory()) {
        const files = fs.readdirSync(servicesDir);
        for (const file of files) {
          if (file.endsWith('.ts')) {
             const servicePath = path.join(servicesDir, file);
             const content = fs.readFileSync(servicePath, 'utf8');
             // Regex to find "export class ClassName"
             const match = content.match(/export\s+class\s+(\w+)/);
             if (match && match[1]) {
               domains.push({
                 dirName: entry.name,
                 className: match[1],
                 absolutePath: servicePath
               });
               // Assume one service per domain for now
               break; 
             }
          }
        }
      } else {
        // Fallback/Legacy check: src/domain/<name>/service.ts
        const servicePath = path.join(domainsDir, entry.name, 'service.ts');
        if (fs.existsSync(servicePath)) {
          const content = fs.readFileSync(servicePath, 'utf8');
          const match = content.match(/export\s+class\s+(\w+)/);
          if (match && match[1]) {
            domains.push({
              dirName: entry.name,
              className: match[1],
              absolutePath: servicePath
            });
          }
        }
      }
    }
  }
  return domains;
};

// --- File Manipulation Helpers ---

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

// --- Main Script ---
async function main() {
  console.log("=====================================");
  console.log("      MCP New Tool Generator         ");
  console.log("=====================================\n");

  // 1. Gather Data
  const domains = getDomains();
  if (domains.length === 0) {
    console.error("[mn] No domains found in src/domain. Please create a domain first.");
    process.exit(1);
  }

  console.log("Available Domain Services:");
  domains.forEach((d, i) => {
    console.log(`  [${i + 1}] ${d.className} (from ${d.dirName})`);
  });

  const selectionIndex = await askQuestion("\nSelect a Domain Service (number): ");
  const selectedDomain = domains[parseInt(selectionIndex.trim()) - 1];

  if (!selectedDomain) {
    console.error("Invalid selection.");
    process.exit(1);
  }

  const methodName = (await askQuestion("New Service Method Name (camelCase, e.g., getWeather): ")).trim();
  const toolName = (await askQuestion("Tool Name (snake_case, e.g., get_weather): ")).trim();
  const toolDescription = (await askQuestion("Tool Description: ")).trim();

  // Derived Names
  const requestDtoName = `${toPascalCase(methodName)}RequestDto`;
  const responseDtoName = `${toPascalCase(methodName)}ResponseDto`;

  console.log("\n[INFO] Generating tool...\n");

  // 2. Update tools.metadata.ts
  injectIntoFile('src/tools.metadata.ts', (content) => {
    const newEntry = `
  ${toolName}: {
    name: "${toolName}",
    description: \`${toolDescription}\`,
  },`;
    // Insert before the last closing brace of the object or before "export default"
    return content.replace(/(const toolMetadata = {[\s\S]*?)(\n})/m, `$1${newEntry}$2`);
  });

  // 3. Update env.ts
  injectIntoFile('src/env.ts', (content) => {
    // Add the tool toggle to TOOLS_ENABLED
    const newToggle = `    process.env.${toolName.toUpperCase()} === "false" ? null : toolMetadata.${toolName}.name,`;
    return content.replace(/(TOOLS_ENABLED:\s*\[[\s\S]*?)(\s*\]\.filter)/, `$1\n${newToggle}$2`);
  });

  // 4. Create DTOs
  // Logic updated: If absolutePath is .../domain/name/services/file.ts, we want .../domain/name/dtos
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

    // Append method before the last closing brace of the class
    const methodImpl = `
  async ${methodName}(dto: ${requestDtoName}): Promise<${responseDtoName} | null> {
    // TODO: Implement logic
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

  // 6. Update src/mcp/tools.ts
  injectIntoFile('src/mcp/tools.ts', (content) => {
    let newContent = content;

    // Ensure Domain Service is imported
    if (!newContent.includes(`import ${selectedDomain.className}`)) {
       // Calculate relative path from src/mcp/tools.ts to the service file
       // e.g. ../domain/<dir>/services/<file>.js
       const toolsDir = path.resolve('src/mcp');
       const relativePath = path.relative(toolsDir, selectedDomain.absolutePath);
       // Ensure POSIX paths for imports and replace extension
       const importPath = relativePath.split(path.sep).join('/').replace(/\.ts$/, '.js');
       
       newContent = `import ${selectedDomain.className} from "./${importPath}";\n` + newContent;
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
    callback: buildTool(${selectedDomain.className}.${methodName})
  },`;

    // Regex to capture the tools object content
    newContent = newContent.replace(
      /(const tools: Record<string, ToolDefinition> = {[\s\S]*?)(\n})/m, 
      (match, p1, p2) => {
        let modifiedContent = p1;
        const lastBraceIndex = modifiedContent.lastIndexOf('}');
        
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

  console.log("\n=====================================");
  console.log("   Tool Created Successfully! 🚀");
  console.log("=====================================");
  console.log(`Don't forget to:`);
  console.log(`1. Implement the logic in ${selectedDomain.absolutePath}`);
  console.log(`2. Define properties in the new DTO file: ${dtoFile}`);
  console.log(`3. Define the Zod schema in src/mcp/tools.ts`);
  
  rl.close();
}

main().catch(err => {
  console.error("\n[FATAL ERROR]", err);
  rl.close();
  process.exit(1);
});