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
  return str.split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

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

const removeCommandFromPackageJson = () => {
   try {
    const packageJsonPath = path.resolve('package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);

      if (packageJson.scripts && packageJson.scripts['startup-project']) {
        delete packageJson.scripts['startup-project'];
        // Write back with 2-space indentation
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
        console.log("[QK] Removed 'startup-project' script from package.json");
      }
    }
  } catch (err) {
    console.warn("[WARN] Failed to remove 'startup-project' script from package.json", err);
  }
}


const deleteStartupScriptFile = () => {
  try {
    // Assuming the script is run from the project root via "npm run startup-project"
    const scriptPath = path.join(process.cwd(), 'scripts', 'startup-project.ts');
    if (fs.existsSync(scriptPath)) {
      fs.unlinkSync(scriptPath);
      console.log(`\n[INFO] Cleanup: Startup script deleted (${scriptPath})`);
    }
  } catch (error) {
    console.warn(`\n[WARN] Failed to delete startup script automatically:`, error);
  }
}


// --- Main Script ---
async function main() {
  console.log("=====================================");
  console.log("   MCP Template Initialization CLI   ");
  console.log("=====================================\n");

  // 1. Collect Inputs
  const projectName = (await askQuestion("1. Project Name (kebab-case, e.g., my-weather-mcp): ")).trim();
  const domainInput = (await askQuestion("2. Domain Name (kebab-case, e.g., weather-forecast): ")).trim();
  const serviceMethod = (await askQuestion("3. Service Method Name (camelCase, e.g., getForecast): ")).trim();
  const toolName = (await askQuestion("4. Tool Name (snake_case, e.g., get_forecast): ")).trim();
  const clientMethodName = (await askQuestion("5. Domain Client Method Name (http.client.ts, db.client.ts) (camelCase, e.g., fetchForecast): ")).trim();
  
  // Transform Inputs
  const domainDirName = domainInput.toLowerCase();
  const domainPascalCase = toPascalCase(domainInput);
  const domainServiceClassName = `${domainPascalCase}Service`;
  const toolEnvVar = toolName.toUpperCase();
  const domainServiceFileName = `${domainInput}.service.ts`;

  // Client transforms
  const dbClientClassName = `${domainPascalCase}DbClient`;
  const httpClientClassName = `${domainPascalCase}HttpClient`;
  const dbClientFileName = `${domainInput}.db.client.ts`;
  const httpClientFileName = `${domainInput}.http.client.ts`;

  // DTO Names (Ensure pascal case from camel case input)
  const serviceMethodPascal = serviceMethod.charAt(0).toUpperCase() + serviceMethod.slice(1);
  const requestDto = `${serviceMethodPascal}RequestDto`;
  const responseDto = `${serviceMethodPascal}ResponseDto`;
  
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
  // Move folder src/domain/domain-name -> src/domain/[domainDirName]
  const oldDomainPath = path.join('src', 'domain', 'domain-name');
  const newDomainPath = path.join('src', 'domain', domainDirName);
  renameDir(oldDomainPath, newDomainPath);

  // Update DTOs
  const dtoDir = path.join(newDomainPath, 'dtos');
  const oldDtoPath = path.join(dtoDir, 'domain.dto.ts');
  const newDtoPath = path.join(dtoDir, `${serviceMethod}.dto.ts`);
  
  // Rename DTO file
  renameDir(oldDtoPath, newDtoPath);

  // Update DTO content
  replaceInFile(newDtoPath, [
    { search: /DomainExampleRequestDto/g, replace: requestDto },
    { search: /DomainExampleResponseDto/g, replace: responseDto }
  ]);

  // --- Update Clients ---
  const clientsDir = path.join(newDomainPath, 'clients');
  const oldDbClientPath = path.join(clientsDir, 'domain.db.client.ts');
  const newDbClientPath = path.join(clientsDir, dbClientFileName);
  const oldHttpClientPath = path.join(clientsDir, 'domain.http.client.ts');
  const newHttpClientPath = path.join(clientsDir, httpClientFileName);

  // Rename Client Files
  renameDir(oldDbClientPath, newDbClientPath);
  renameDir(oldHttpClientPath, newHttpClientPath);

  // Update DB Client Content
  replaceInFile(newDbClientPath, [
    { search: /class DomainDbClient/g, replace: `class ${dbClientClassName}` },
    { search: /async example\(/g, replace: `async ${clientMethodName}(` },
    // DTO Updates
    { search: /"\.\.\/dtos\/domain\.dto\.js"/g, replace: `"../dtos/${serviceMethod}.dto.js"` },
    { search: /DomainExampleRequestDto/g, replace: requestDto },
    { search: /DomainExampleResponseDto/g, replace: responseDto }
  ]);

  // Update HTTP Client Content
  replaceInFile(newHttpClientPath, [
    { search: /class DomainHttpClient/g, replace: `class ${httpClientClassName}` },
    { search: /async example\(/g, replace: `async ${clientMethodName}(` },
    // DTO Updates
    { search: /"\.\.\/dtos\/domain\.dto\.js"/g, replace: `"../dtos/${serviceMethod}.dto.js"` },
    { search: /DomainExampleRequestDto/g, replace: requestDto },
    { search: /DomainExampleResponseDto/g, replace: responseDto }
  ]);

  // Update src/domain/[domainDirName]/services/domain.ts -> [domainInput].service.ts
  const servicesDir = path.join(newDomainPath, 'services');
  const oldServiceFile = path.join(servicesDir, 'domain.service.ts'); // Current default file in template
  const newServiceFile = path.join(servicesDir, domainServiceFileName); // New specific name

  if (fs.existsSync(oldServiceFile)) {
    fs.renameSync(oldServiceFile, newServiceFile);
    console.log(`[QK] Renamed ${oldServiceFile} to ${newServiceFile}`);
  } else {
    console.warn(`[WARN] Service file not found at ${oldServiceFile}`);
  }

  replaceInFile(newServiceFile, [
    { search: /class DomainService/g, replace: `class ${domainServiceClassName}` },
    // Update the method definition
    { search: /async example\(/g, replace: `async ${serviceMethod}(` },
    
    // Update Imports to point to new client file and class
    { search: /"\.\.\/clients\/domain\.http\.client\.js"/g, replace: `"../clients/${httpClientFileName.replace('.ts', '.js')}"` },
    { search: /DomainHttpClient/g, replace: httpClientClassName },
    
    // Update usage of client method
    { search: /this\.httpClient\.example\(/g, replace: `this.httpClient.${clientMethodName}(` },

    // Update the export default new ...
    { search: /new DomainService\(/g, replace: `new ${domainServiceClassName}(` },
    
    // Update DTO imports (handling the new DTO filename)
    { search: /"\.\.\/dtos\/domain\.dto\.js"/g, replace: `"../dtos/${serviceMethod}.dto.js"` },
    { search: /DomainExampleRequestDto/g, replace: requestDto },
    { search: /DomainExampleResponseDto/g, replace: responseDto }
  ]);

  // 5. Update MCP Tools Registration (src/mcp/tools.ts)
  // We need to update imports and the usage of the service
  replaceInFile('src/mcp/tools.ts', [
    // 1. Update Import Path: "../domain/domain-name/services/domain.js" -> "../[domainDirName]/services/[domainInput].service.js"
    { search: /domain-name\/services\/domain\.js/g, replace: `${domainDirName}/services/${domainServiceFileName.replace('.ts', '.js')}` },
    
    // 2. Update Import Variable: "import DomainService" -> "import [DomainServiceClassName]"
    { search: /import DomainService/g, replace: `import ${domainServiceClassName}` },

    // 3. Update Usage in Callback: "DomainService.example" -> "[DomainServiceClassName].[method]"
    { search: /DomainService\.example/g, replace: `${domainServiceClassName}.${serviceMethod}` },

    // 4. Update usage in .bind(): ".bind(DomainService)" -> ".bind([DomainServiceClassName])"
    { search: /\.bind\(DomainService\)/g, replace: `.bind(${domainServiceClassName})` },

    // 5. Update Tool Metadata Keys: toolMetadata.example_tool -> toolMetadata.[toolName]
    { search: /toolMetadata\.example_tool/g, replace: `toolMetadata.${toolName}` }
  ]);

  console.log("\n=====================================");
  console.log("   Configuration Complete! 🚀");
  console.log("=====================================");
  console.log(`1. Project renamed to: ${projectName}`);
  console.log(`2. Domain setup: src/domain/${domainDirName}/services/${domainServiceFileName}`);
  console.log(`3. Clients setup: src/domain/${domainDirName}/clients/`);
  console.log(`4. Tool configured: ${toolName}`);
  console.log("\nNext Steps:");
  console.log("  npm install");
  console.log("  npm run build");
  console.log("  npm run start");
  
  rl.close();

  deleteStartupScriptFile();
  removeCommandFromPackageJson();
}

main().catch(err => {
  console.error("\n[FATAL ERROR]", err);
  rl.close();
  process.exit(1);
});