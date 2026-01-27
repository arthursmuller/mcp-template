import * as fs from 'fs';
import * as path from 'path';
import { askQuestion, getReadLineInterface, toPascalCase, toKebabCase, toCamelCase, logBanner, logEndBanner } from './utils.js';

const rl = getReadLineInterface();

async function main() {
  logBanner("MCP Domain Generator");

  // 1. Domain Name
  const domainNameRaw = (await askQuestion(rl, "1. Domain Name (kebab-case, e.g., weather-data): ")).trim();
  if (!domainNameRaw) {
    console.error("Domain name is required.");
    process.exit(1);
  }
  const domainDirName = toKebabCase(domainNameRaw);
  const domainBasePath = path.join('src/domain', domainDirName);

  if (fs.existsSync(domainBasePath)) {
    console.error(`Error: Domain '${domainDirName}' already exists.`);
    process.exit(1);
  }

  // 2. HTTP Client
  const addHttpRaw = (await askQuestion(rl, "2. Add HTTP Client? (y/N): ")).trim().toLowerCase();
  const addHttp = addHttpRaw === 'y' || addHttpRaw === 'yes';

  // 3. DB Client
  const addDbRaw = (await askQuestion(rl, "3. Add DB Client? (y/N): ")).trim().toLowerCase();
  const addDb = addDbRaw === 'y' || addDbRaw === 'yes';

  // 4. Client Method Name (if applicable)
  let clientMethodName = 'fetchData';
  if (addHttp || addDb) {
    const rawMethod = (await askQuestion(rl, "4. Client Method Name (camelCase, e.g., fetchData): ")).trim();
    if (rawMethod) clientMethodName = toCamelCase(rawMethod);
  }

  // 5. Service Method Name
  const serviceMethodRaw = (await askQuestion(rl, "5. Service Method Name (camelCase, e.g., getWeatherData): ")).trim();
  const serviceMethodName = serviceMethodRaw ? toCamelCase(serviceMethodRaw) : 'getData';

  console.log("\n[INFO] Generating domain structure...\n");

  // --- Directories ---
  const clientsDir = path.join(domainBasePath, 'clients');
  const servicesDir = path.join(domainBasePath, 'services');
  const dtosDir = path.join(domainBasePath, 'dtos');
  const utilsDir = path.join(domainBasePath, 'utils');

  fs.mkdirSync(domainBasePath, { recursive: true });
  fs.mkdirSync(clientsDir);
  fs.mkdirSync(servicesDir);
  fs.mkdirSync(dtosDir);
  if (addHttp) fs.mkdirSync(utilsDir);

  // --- Names & Paths ---
  const domainPascal = toPascalCase(domainDirName);
  
  // DTOs
  const dtoFileName = `${serviceMethodName}.dto.ts`;
  const requestDtoName = `${toPascalCase(serviceMethodName)}RequestDto`;
  const responseDtoName = `${toPascalCase(serviceMethodName)}ResponseDto`;

  // Clients
  const httpClientClassName = `${domainPascal}HttpClient`;
  const dbClientClassName = `${domainPascal}DbClient`;
  
  const httpClientFileName = `${domainDirName}.http.client.ts`;
  const dbClientFileName = `${domainDirName}.db.client.ts`;

  // Service
  const serviceClassName = `${domainPascal}Service`;
  const serviceFileName = `${domainDirName}.service.ts`;

  // --- File Generation ---

  // 1. DTOs
  const dtoContent = `
export interface ${requestDtoName} {
  // TODO: Add request properties
  data?: any;
}

export interface ${responseDtoName} {
  // TODO: Add response properties
  data?: any;
}
`;
  fs.writeFileSync(path.join(dtosDir, dtoFileName), dtoContent.trim());
  console.log(`[CREATE] DTO: dtos/${dtoFileName}`);

  // 2. Utils (if HTTP)
  if (addHttp) {
    const utilsContent = `
import env from "../../../env.js";

export function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  // TODO: Add custom headers if needed
  // headers["Authorization"] = env.API.headers.ApiKey;
  return headers;
}
`;
    fs.writeFileSync(path.join(utilsDir, 'api.ts'), utilsContent.trim());
    console.log(`[CREATE] Utils: utils/api.ts`);
  }

  // 3. HTTP Client
  if (addHttp) {
    const httpContent = `
import HttpClient from "../../../api/client.js";
import { getHeaders } from "../utils/api.js";
import env from "../../../env.js";
import { ${requestDtoName}, ${responseDtoName} } from "../dtos/${serviceMethodName}.dto.js";

export class ${httpClientClassName} {
  private readonly httpClient: HttpClient;

  constructor() {
    // TODO: Implement correct api URL
    this.httpClient = new HttpClient(env.API.Url, getHeaders())
  }

  async ${clientMethodName}(dto: ${requestDtoName}): Promise<${responseDtoName} | null> {
    try {
      // TODO: Configure path and method
      const response = await this.httpClient.post<${responseDtoName}>("/", dto);
      return response;
    } catch (error) {
      console.error("[${httpClientClassName}] Error:", error);
      return null;
    }
  }
}
`;
    fs.writeFileSync(path.join(clientsDir, httpClientFileName), httpContent.trim());
    console.log(`[CREATE] HTTP Client: clients/${httpClientFileName}`);
  }

  // 4. DB Client
  if (addDb) {
    const dbContent = `
import { ${requestDtoName}, ${responseDtoName} } from "../dtos/${serviceMethodName}.dto.js";

export class ${dbClientClassName} {
  async ${clientMethodName}(dto: ${requestDtoName}): Promise<${responseDtoName} | null> {
    // TODO: Implement database logic
    return null;
  }
}
`;
    fs.writeFileSync(path.join(clientsDir, dbClientFileName), dbContent.trim());
    console.log(`[CREATE] DB Client: clients/${dbClientFileName}`);
  }

  // 5. Service
  const imports: string[] = [];
  const ctorParams: string[] = [];
  const initParams: string[] = [];
  
  if (addHttp) {
    imports.push(`import { ${httpClientClassName} } from "../clients/${domainDirName}.http.client.js";`);
    ctorParams.push(`private readonly httpClient: ${httpClientClassName}`);
    initParams.push(`new ${httpClientClassName}()`);
  }
  
  if (addDb) {
    imports.push(`import { ${dbClientClassName} } from "../clients/${domainDirName}.db.client.js";`);
    ctorParams.push(`private readonly dbClient: ${dbClientClassName}`);
    initParams.push(`new ${dbClientClassName}()`);
  }

  imports.push(`import { ${requestDtoName}, ${responseDtoName} } from "../dtos/${serviceMethodName}.dto.js";`);

  // Build method body
  let methodBody = `    // TODO: Implement business logic\n`;
  if (addHttp || addDb) {
    const clientVar = addHttp ? 'this.httpClient' : 'this.dbClient'; // prioritize http example if both present, or just show one
    methodBody += `    const result = await ${clientVar}.${clientMethodName}(dto);\n    return result;`;
  } else {
    methodBody += `    return null;`;
  }

  const serviceContent = `
${imports.join('\n')}

export class ${serviceClassName} {
  constructor(${ctorParams.join(', ')}) {}

  async ${serviceMethodName}(dto: ${requestDtoName}): Promise<${responseDtoName} | null> {
${methodBody}
  }
}

export default new ${serviceClassName}(${initParams.join(', ')});
`;

  fs.writeFileSync(path.join(servicesDir, serviceFileName), serviceContent.trim());
  console.log(`[CREATE] Service: services/${serviceFileName}`);

  logEndBanner("Domain");
  
  console.log(`Don't forget to:`);
  console.log(`1. Run 'npm run new-tool' to expose this service as an MCP tool.`);
  
  rl.close();
}

main().catch(err => {
  console.error(err);
  rl.close();
  process.exit(1);
});