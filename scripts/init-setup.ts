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
const replaceInFile = (filePath: string, replacements: { search: RegExp | string, replace: string }[]) => {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`[WARN] File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let hasChanges = false;
  
  replacements.forEach(({ search, replace }) => {
    const original = content;
    content = content.split(search).join(replace); // Simple string replace all
    if (content !== original) hasChanges = true;
    
    // Also try regex if provided
    if (search instanceof RegExp) {
        const regexOriginal = content;
        content = content.replace(search, replace);
        if (content !== regexOriginal) hasChanges = true;
    }
  });

  if (hasChanges) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`[QK] Updated ${filePath}`);
  } else {
    console.log(`[QK] No changes needed for ${filePath}`);
  }
};

const renameDir = (oldPath: string, newPath: string) => {
  if (fs.existsSync(oldPath)) {
    // If new path exists, we can't just move, but for init we assume clean state
    if (fs.existsSync(newPath)) {
        console.warn(`[WARN] Destination directory ${newPath} already exists. Skipping rename.`);
        return;
    }
    fs.renameSync(oldPath, newPath);
    console.log(`[QK] Renamed directory ${oldPath} to ${newPath}`);
  } else {
     console.warn(`[WARN] Source directory ${oldPath} not found.`);
  }
};

// --- Main Script ---
async function main() {
  console.log("=====================================");
  console.log("   MCP Template Initialization CLI   ");
  console.log("=====================================\n");

  // 1. Collect Inputs
  const projectName = (await askQuestion("1. Project Name (kebab-case, e.g., my-weather-mcp): ")).trim();
  const domainName = (await askQuestion("2. Domain Name (PascalCase, e.g., Weather): ")).trim();
  const serviceMethod = (await askQuestion("3. Service Method Name (camelCase, e.g., getForecast): ")).trim();
  const toolName = (await askQuestion("4. Tool Name (snake_case, e.g., get_forecast): ")).trim();
  
  const domainLower = domainName.toLowerCase();
  const toolEnvVar = toolName.toUpperCase();
  
  console.log("\n[INFO] Starting configuration...\n");

  // 2. Update Metadata & Config Files
  // package.json
  replaceInFile('package.json', [
    { search: /"name": "example-mcp-proj-name"/, replace: `"name": "${projectName}"` },
    { search: /"description": "example-mcp-proj-name"/, replace: `"description": "${projectName}"` }
  ]);
  
  // package-lock.json
  replaceInFile('package-lock.json', [
    { search: /"name": "example-mcp-proj-name"/g, replace: `"name": "${projectName}"` }
  ]);

  // readme.md
  replaceInFile('readme.md', [
    { search: /example-mcp-proj-name/g, replace: projectName }
  ]);

  // src/env.ts
  replaceInFile('src/env.ts', [
    { search: /SERVER_NAME: "example-mcp-proj-name"/, replace: `SERVER_NAME: "${projectName}"` },
    { search: /process\.env\.EXAMPLE_TOOL/g, replace: `process.env.${toolEnvVar}` },
    { search: /toolMetadata\.example_tool\.name/g, replace: `toolMetadata.${toolName}.name` }
  ]);

  // 3. Update Metadata (src/tools.metadata.ts)
  replaceInFile('src/tools.metadata.ts', [
    { search: /example_tool:/g, replace: `${toolName}:` },
    { search: /name: "example_tool"/g, replace: `name: "${toolName}"` }
  ]);

  // 4. Update Domain Layer
  // Move folder src/domain -> src/[domainLower]
  const oldDomainPath = path.join('src', 'domain');
  const newDomainPath = path.join('src', domainLower);
  renameDir(oldDomainPath, newDomainPath);

  // Update src/[domainLower]/service.ts
  const serviceFile = path.join(newDomainPath, 'service.ts');
  replaceInFile(serviceFile, [
    { search: /class DomainService/g, replace: `class ${domainName}Service` },
    // Update the method definition
    { search: /async example\(/g, replace: `async ${serviceMethod}(` },
    // Update the export default new ...
    { search: /new DomainService\(/g, replace: `new ${domainName}Service(` }
  ]);

  // 5. Update MCP Tools Registration (src/mcp/tools.ts)
  // We need to update imports and the usage of the service
  replaceInFile('src/mcp/tools.ts', [
    // 1. Update Import Path: "../domain/service.js" -> "../weather/service.js"
    { search: /"\.\.\/domain\/service\.js"/g, replace: `"\.\.\/${domainLower}\/service\.js"` },
    
    // 2. Update Import Variable: "import DomainService" -> "import WeatherService"
    // Note: The file likely does "import DomainService from..." so we rename the local var.
    { search: /import DomainService/g, replace: `import ${domainName}Service` },

    // 3. Update Usage in Callback: "DomainService.example" -> "WeatherService.getForecast"
    { search: /DomainService\.example/g, replace: `${domainName}Service.${serviceMethod}` },

    // 4. Update Tool Metadata Keys: toolMetadata.example_tool -> toolMetadata.get_forecast
    { search: /toolMetadata\.example_tool/g, replace: `toolMetadata.${toolName}` }
  ]);

  console.log("\n=====================================");
  console.log("   Configuration Complete! 🚀");
  console.log("=====================================");
  console.log(`1. Project renamed to: ${projectName}`);
  console.log(`2. Domain setup: src/${domainLower}/service.ts`);
  console.log(`3. Tool configured: ${toolName}`);
  console.log("\nNext Steps:");
  console.log("  npm install");
  console.log("  npm run build");
  console.log("  npm run start");
  
  rl.close();
}

main().catch(err => {
  console.error("\n[FATAL ERROR]", err);
  rl.close();
  process.exit(1);
});