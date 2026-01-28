import * as fs from 'fs';
import * as path from 'path';
import { 
  askQuestion,
  toKebabCase,
  toCamelCase,
  toSnakeCase,
  toPascalCase,
  getReadLineInterface,
  logEndBanner,
  execute
} from '../utils.js';

const rl = getReadLineInterface();

interface RawInputs {
  projectNameRaw: string;
  domainInputRaw: string;
  serviceMethodRaw: string;
  toolNameRaw: string;
  clientMethodNameRaw: string;
}

interface ProjectConfig {
  // Inputs
  projectName: string;
  domainInput: string;
  serviceMethod: string;
  toolName: string;
  clientMethodName: string;

  // Derived Values
  domainDirName: string;
  domainPascalCase: string;
  domainServiceClassName: string;
  toolEnvVar: string;
  domainServiceFileName: string;

  // Client Transforms
  dbClientClassName: string;
  httpClientClassName: string;
  dbClientFileName: string;
  httpClientFileName: string;

  // DTO Names
  serviceMethodPascal: string;
  requestDto: string;
  responseDto: string;
}

// --- Helpers ---

const endMessage = (config: ProjectConfig) => {
  logEndBanner("Configuration");
  console.log(`1. Project renamed to: ${config.projectName}`);
  console.log(`2. Domain setup: src/domain/${config.domainDirName}/services/${config.domainServiceFileName}`);
  console.log(`3. Clients setup: src/domain/${config.domainDirName}/clients/`);
  console.log(`4. Tool configured: ${config.toolName}`);
  console.log("\nNext Steps:");
  console.log("  npm install");
  console.log("  npm run build");
  console.log("  npm run start");
}

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

const renameFile = (oldPath: string, newPath: string) => {
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    console.log(`[QK] Renamed ${oldPath} to ${newPath}`);
  } else {
    console.warn(`[WARN] File not found at ${oldPath}`);
  }
};

const cleanup = () => {
  try {
    // Remove command from package.json
    const packageJsonPath = path.resolve('package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);

      if (packageJson.scripts && packageJson.scripts['startup-project']) {
        delete packageJson.scripts['startup-project'];
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
        console.log("[QK] Removed 'startup-project' script from package.json");
      }
    }

    // Delete script file
    const scriptPath = path.join(process.cwd(), 'scripts', 'startup-project.ts');
    if (fs.existsSync(scriptPath)) {
      fs.unlinkSync(scriptPath);
      console.log(`\n[INFO] Cleanup: Startup script deleted (${scriptPath})`);
    }
  } catch (err) {
    console.warn("[WARN] Cleanup failed", err);
  }
}

// --- Main Steps ---

const loadInputs = async (): Promise<RawInputs> => {
  const projectNameRaw = (await askQuestion(rl, "1. Project Name (kebab-case, e.g., my-weather-mcp): ")).trim();
  const domainInputRaw = (await askQuestion(rl, "2. Domain Name (kebab-case, e.g., weather-forecast): ")).trim();
  const serviceMethodRaw = (await askQuestion(rl, "3. Service Method Name (camelCase, e.g., getForecast): ")).trim();
  const toolNameRaw = (await askQuestion(rl, "4. Tool Name (snake_case, e.g., get_forecast): ")).trim();
  const clientMethodNameRaw = (await askQuestion(rl, "5. Domain Client Method Name (camelCase, e.g., fetchForecast): ")).trim();

  return { projectNameRaw, domainInputRaw, serviceMethodRaw, toolNameRaw, clientMethodNameRaw };
};

const transformInputs = (inputs: RawInputs): ProjectConfig => {
  // Transform Inputs
  const projectName = toKebabCase(inputs.projectNameRaw);
  const domainInput = toKebabCase(inputs.domainInputRaw);
  const serviceMethod = toCamelCase(inputs.serviceMethodRaw);
  const toolName = toSnakeCase(inputs.toolNameRaw);
  const clientMethodName = toCamelCase(inputs.clientMethodNameRaw);

  // Derived Values
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

  // DTO Names
  const serviceMethodPascal = toPascalCase(inputs.serviceMethodRaw);
  const requestDto = `${serviceMethodPascal}RequestDto`;
  const responseDto = `${serviceMethodPascal}ResponseDto`;

  console.log("\n[INFO] Configuration confirmed:");
  console.log(`  Project: ${projectName}`);
  console.log(`  Domain:  ${domainInput}`);
  console.log(`  Service: ${serviceMethod}`);
  console.log(`  Tool:    ${toolName}`);
  console.log(`  Client:  ${clientMethodName}`);
  
  console.log("\n[INFO] Starting configuration...\n");

  return {
    projectName,
    domainInput,
    serviceMethod,
    toolName,
    clientMethodName,
    domainDirName,
    domainPascalCase,
    domainServiceClassName,
    toolEnvVar,
    domainServiceFileName,
    dbClientClassName,
    httpClientClassName,
    dbClientFileName,
    httpClientFileName,
    serviceMethodPascal,
    requestDto,
    responseDto
  };
};

const updateGlobalConfig = (config: ProjectConfig) => {
  // package.json
  replaceInFile('package.json', [
    { search: /"name": "example-mcp-proj-name"/, replace: `"name": "${config.projectName}"` },
    { search: /"description": "example-mcp-proj-name"/, replace: `"description": "${config.projectName}"` }
  ]);
  
  // package-lock.json
  replaceInFile('package-lock.json', [
    { search: /"name": "example-mcp-proj-name"/g, replace: `"name": "${config.projectName}"` }
  ]);

  // readme.md
  replaceInFile('readme.md', [
    { search: /example-mcp-proj-name/g, replace: config.projectName }
  ]);

  // src/env.ts
  replaceInFile('src/env.ts', [
    { search: /SERVER_NAME: "example-mcp-proj-name"/, replace: `SERVER_NAME: "${config.projectName}"` },
    { search: /process\.env\.EXAMPLE_TOOL/g, replace: `process.env.${config.toolEnvVar}` },
    { search: /toolMetadata\.example_tool\.name/g, replace: `toolMetadata.${config.toolName}.name` }
  ]);

  // src/tools.metadata.ts
  replaceInFile('src/tools.metadata.ts', [
    { search: /example_tool:/g, replace: `${config.toolName}:` },
    { search: /name: "example_tool"/g, replace: `name: "${config.toolName}"` }
  ]);
};

const updateDomainStructure = (config: ProjectConfig) => {
  // 1. Move folder src/domain/domain-name -> src/domain/[domainDirName]
  const oldDomainPath = path.join('src', 'domain', 'domain-name');
  const newDomainPath = path.join('src', 'domain', config.domainDirName);
  renameDir(oldDomainPath, newDomainPath);

  // 2. Rename DTO file
  const dtoDir = path.join(newDomainPath, 'dtos');
  const oldDtoPath = path.join(dtoDir, 'domain.dto.ts');
  const newDtoPath = path.join(dtoDir, `${config.serviceMethod}.dto.ts`);
  renameFile(oldDtoPath, newDtoPath);

  // 3. Rename Client Files
  const clientsDir = path.join(newDomainPath, 'clients');
  const oldDbClientPath = path.join(clientsDir, 'domain.db.client.ts');
  const newDbClientPath = path.join(clientsDir, config.dbClientFileName);
  renameFile(oldDbClientPath, newDbClientPath);

  const oldHttpClientPath = path.join(clientsDir, 'domain.http.client.ts');
  const newHttpClientPath = path.join(clientsDir, config.httpClientFileName);
  renameFile(oldHttpClientPath, newHttpClientPath);

  // 4. Rename Service File
  const servicesDir = path.join(newDomainPath, 'services');
  const oldServiceFile = path.join(servicesDir, 'domain.service.ts'); 
  const newServiceFile = path.join(servicesDir, config.domainServiceFileName); 
  renameFile(oldServiceFile, newServiceFile);
};

const updateDomainContent = (config: ProjectConfig) => {
  const domainPath = path.join('src', 'domain', config.domainDirName);
  const dtoPath = path.join(domainPath, 'dtos', `${config.serviceMethod}.dto.ts`);
  
  // DTOs
  replaceInFile(dtoPath, [
    { search: /DomainExampleRequestDto/g, replace: config.requestDto },
    { search: /DomainExampleResponseDto/g, replace: config.responseDto }
  ]);

  // Clients
  const clientsDir = path.join(domainPath, 'clients');
  const dbClientPath = path.join(clientsDir, config.dbClientFileName);
  const httpClientPath = path.join(clientsDir, config.httpClientFileName);

  // Update DB Client
  replaceInFile(dbClientPath, [
    { search: /class DomainDbClient/g, replace: `class ${config.dbClientClassName}` },
    { search: /async example\(/g, replace: `async ${config.clientMethodName}(` },
    { search: /"\.\.\/dtos\/domain\.dto\.js"/g, replace: `"../dtos/${config.serviceMethod}.dto.js"` },
    { search: /DomainExampleRequestDto/g, replace: config.requestDto },
    { search: /DomainExampleResponseDto/g, replace: config.responseDto }
  ]);

  // Update HTTP Client
  replaceInFile(httpClientPath, [
    { search: /class DomainHttpClient/g, replace: `class ${config.httpClientClassName}` },
    { search: /async example\(/g, replace: `async ${config.clientMethodName}(` },
    { search: /"\.\.\/dtos\/domain\.dto\.js"/g, replace: `"../dtos/${config.serviceMethod}.dto.js"` },
    { search: /DomainExampleRequestDto/g, replace: config.requestDto },
    { search: /DomainExampleResponseDto/g, replace: config.responseDto }
  ]);

  // Service
  const servicePath = path.join(domainPath, 'services', config.domainServiceFileName);
  replaceInFile(servicePath, [
    { search: /class DomainService/g, replace: `class ${config.domainServiceClassName}` },
    { search: /async example\(/g, replace: `async ${config.serviceMethod}(` },
    
    // Imports & Client Usage
    { search: /"\.\.\/clients\/domain\.http\.client\.js"/g, replace: `"../clients/${config.httpClientFileName.replace('.ts', '.js')}"` },
    { search: /DomainHttpClient/g, replace: config.httpClientClassName },
    { search: /this\.httpClient\.example\(/g, replace: `this.httpClient.${config.clientMethodName}(` },
    { search: /new DomainService\(/g, replace: `new ${config.domainServiceClassName}(` },
    
    // DTOs
    { search: /"\.\.\/dtos\/domain\.dto\.js"/g, replace: `"../dtos/${config.serviceMethod}.dto.js"` },
    { search: /DomainExampleRequestDto/g, replace: config.requestDto },
    { search: /DomainExampleResponseDto/g, replace: config.responseDto }
  ]);
};

const updateMcpRegistry = (config: ProjectConfig) => {
  replaceInFile('src/mcp/tools.ts', [
    // 1. Update Import Path
    { search: /domain-name\/services\/domain\.service\.js/g, replace: `${config.domainDirName}/services/${config.domainServiceFileName.replace('.ts', '.js')}` },
    
    // 2. Update Import Variable
    { search: /import DomainService/g, replace: `import ${config.domainServiceClassName}` },

    // 3. Update Usage in Callback
    { search: /DomainService\.example/g, replace: `${config.domainServiceClassName}.${config.serviceMethod}` },

    // 4. Update usage in .bind()
    { search: /\.bind\(DomainService\)/g, replace: `.bind(${config.domainServiceClassName})` },

    // 5. Update Tool Metadata Keys
    { search: /toolMetadata\.example_tool/g, replace: `toolMetadata.${config.toolName}` }
  ]);
};

execute(rl, "MCP Template Initialization CLI", async () => {
  const rawInputs = await loadInputs();
  const config = transformInputs(rawInputs);
  updateGlobalConfig(config);
  updateDomainStructure(config);
  updateDomainContent(config);
  updateMcpRegistry(config);
  endMessage(config);
  cleanup();
})