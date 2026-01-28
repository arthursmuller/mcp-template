import * as fs from 'fs';
import * as path from 'path';
import { 
  askQuestion, 
  getReadLineInterface, 
  toPascalCase, 
  toKebabCase, 
  toCamelCase, 
  logEndBanner, 
  execute 
} from '../utils.js';

const rl = getReadLineInterface();

// --- Types ---

interface RawInputs {
  domainNameRaw: string;
  addHttpRaw: string;
  addDbRaw: string;
  clientMethodNameRaw: string;
  serviceMethodRaw: string;
}

interface DomainConfig {
  domainDirName: string;
  domainBasePath: string;
  addHttp: boolean;
  addDb: boolean;
  clientMethodName: string;
  serviceMethodName: string;
  
  // Derived Paths
  paths: {
    clients: string;
    services: string;
    dtos: string;
    utils: string;
  };

  // Derived Names
  names: {
    domainPascal: string;
    dtoFileName: string;
    requestDtoName: string;
    responseDtoName: string;
    httpClientClassName: string;
    dbClientClassName: string;
    httpClientFileName: string;
    dbClientFileName: string;
    serviceClassName: string;
    serviceFileName: string;
  };
}


function endMessage() {
  logEndBanner("Domain");

  console.log(`Don't forget to:`);
  console.log(`1. Run 'npm run scaffold:tool' to expose this service as an MCP tool.`);
}

// --- 1. Input Gathering ---

const loadInputs = async (): Promise<RawInputs> => {
  // 1. Domain Name
  const domainNameRaw = (await askQuestion(rl, "1. Domain Name (kebab-case, e.g., weather-data): ")).trim();
  
  // 2. HTTP Client
  const addHttpRaw = (await askQuestion(rl, "2. Add HTTP Client? (y/N): ")).trim().toLowerCase();
  
  // 3. DB Client
  const addDbRaw = (await askQuestion(rl, "3. Add DB Client? (y/N): ")).trim().toLowerCase();

  // 4. Client Method Name (if applicable)
  let clientMethodNameRaw = '';
  if ((addHttpRaw === 'y' || addHttpRaw === 'yes') || (addDbRaw === 'y' || addDbRaw === 'yes')) {
    clientMethodNameRaw = (await askQuestion(rl, "4. Client Method Name (camelCase, e.g., fetchData): ")).trim();
  }

  // 5. Service Method Name
  const serviceMethodRaw = (await askQuestion(rl, "5. Service Method Name (camelCase, e.g., getWeatherData): ")).trim();

  return {
    domainNameRaw,
    addHttpRaw,
    addDbRaw,
    clientMethodNameRaw,
    serviceMethodRaw
  };
};

// --- 2. Configuration & Validation ---

const createDomainConfig = (inputs: RawInputs): DomainConfig => {
  if (!inputs.domainNameRaw) {
    throw new Error("Domain name is required.");
  }

  const domainDirName = toKebabCase(inputs.domainNameRaw);
  const domainBasePath = path.join('src/domain', domainDirName);

  if (fs.existsSync(domainBasePath)) {
    throw new Error(`Domain '${domainDirName}' already exists.`);
  }

  const addHttp = inputs.addHttpRaw === 'y' || inputs.addHttpRaw === 'yes';
  const addDb = inputs.addDbRaw === 'y' || inputs.addDbRaw === 'yes';

  // Method Names
  let clientMethodName = 'fetchData';
  if (inputs.clientMethodNameRaw) {
    clientMethodName = toCamelCase(inputs.clientMethodNameRaw);
  }

  const serviceMethodName = inputs.serviceMethodRaw ? toCamelCase(inputs.serviceMethodRaw) : 'getData';

  // Naming Conventions
  const domainPascal = toPascalCase(domainDirName);
  
  return {
    domainDirName,
    domainBasePath,
    addHttp,
    addDb,
    clientMethodName,
    serviceMethodName,
    paths: {
      clients: path.join(domainBasePath, 'clients'),
      services: path.join(domainBasePath, 'services'),
      dtos: path.join(domainBasePath, 'dtos'),
      utils: path.join(domainBasePath, 'utils'),
    },
    names: {
      domainPascal,
      dtoFileName: `${serviceMethodName}.dto.ts`,
      requestDtoName: `${toPascalCase(serviceMethodName)}RequestDto`,
      responseDtoName: `${toPascalCase(serviceMethodName)}ResponseDto`,
      httpClientClassName: `${domainPascal}HttpClient`,
      dbClientClassName: `${domainPascal}DbClient`,
      httpClientFileName: `${domainDirName}.http.client.ts`,
      dbClientFileName: `${domainDirName}.db.client.ts`,
      serviceClassName: `${domainPascal}Service`,
      serviceFileName: `${domainDirName}.service.ts`,
    }
  };
};

// --- 3. Directory Setup ---

const createDirectories = (config: DomainConfig) => {
  console.log("\n[INFO] Generating domain structure...\n");
  fs.mkdirSync(config.domainBasePath, { recursive: true });
  fs.mkdirSync(config.paths.clients);
  fs.mkdirSync(config.paths.services);
  fs.mkdirSync(config.paths.dtos);
  if (config.addHttp) fs.mkdirSync(config.paths.utils);
};

// --- 4. File Generators ---

const createDtoFile = (config: DomainConfig) => {
  const content = `
export interface ${config.names.requestDtoName} {
  // TODO: Add request properties
  data?: any;
}

export interface ${config.names.responseDtoName} {
  // TODO: Add response properties
  data?: any;
}
`;
  const filePath = path.join(config.paths.dtos, config.names.dtoFileName);
  fs.writeFileSync(filePath, content.trim());
  console.log(`[CREATE] DTO: dtos/${config.names.dtoFileName}`);
};

const createUtilsFile = (config: DomainConfig) => {
  if (!config.addHttp) return;

  const content = `
import env from "../../../env.js";

export function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  // TODO: Add custom headers if needed
  // headers["Authorization"] = env.API.headers.ApiKey;
  return headers;
}
`;
  const filePath = path.join(config.paths.utils, 'api.ts');
  fs.writeFileSync(filePath, content.trim());
  console.log(`[CREATE] Utils: utils/api.ts`);
};

const createHttpClientFile = (config: DomainConfig) => {
  if (!config.addHttp) return;

  const content = `
import HttpClient from "../../../api/client.js";
import { getHeaders } from "../utils/api.js";
import env from "../../../env.js";
import { ${config.names.requestDtoName}, ${config.names.responseDtoName} } from "../dtos/${config.names.dtoFileName.replace('.ts', '.js')}";

export class ${config.names.httpClientClassName} {
  private readonly httpClient: HttpClient;

  constructor() {
    // TODO: Implement correct api URL
    this.httpClient = new HttpClient(env.API.Url, getHeaders())
  }

  async ${config.clientMethodName}(dto: ${config.names.requestDtoName}): Promise<${config.names.responseDtoName} | null> {
    try {
      // TODO: Configure path and method
      const response = await this.httpClient.post<${config.names.responseDtoName}>("/", dto);
      return response;
    } catch (error) {
      console.error("[${config.names.httpClientClassName}] Error:", error);
      return null;
    }
  }
}
`;
  const filePath = path.join(config.paths.clients, config.names.httpClientFileName);
  fs.writeFileSync(filePath, content.trim());
  console.log(`[CREATE] HTTP Client: clients/${config.names.httpClientFileName}`);
};

const createDbClientFile = (config: DomainConfig) => {
  if (!config.addDb) return;

  const content = `
import { ${config.names.requestDtoName}, ${config.names.responseDtoName} } from "../dtos/${config.names.dtoFileName.replace('.ts', '.js')}";

export class ${config.names.dbClientClassName} {
  async ${config.clientMethodName}(dto: ${config.names.requestDtoName}): Promise<${config.names.responseDtoName} | null> {
    // TODO: Implement database logic
    return null;
  }
}
`;
  const filePath = path.join(config.paths.clients, config.names.dbClientFileName);
  fs.writeFileSync(filePath, content.trim());
  console.log(`[CREATE] DB Client: clients/${config.names.dbClientFileName}`);
};

const createServiceFile = (config: DomainConfig) => {
  const imports: string[] = [];
  const ctorParams: string[] = [];
  const initParams: string[] = [];
  
  if (config.addHttp) {
    imports.push(`import { ${config.names.httpClientClassName} } from "../clients/${config.domainDirName}.http.client.js";`);
    ctorParams.push(`private readonly httpClient: ${config.names.httpClientClassName}`);
    initParams.push(`new ${config.names.httpClientClassName}()`);
  }
  
  if (config.addDb) {
    imports.push(`import { ${config.names.dbClientClassName} } from "../clients/${config.domainDirName}.db.client.js";`);
    ctorParams.push(`private readonly dbClient: ${config.names.dbClientClassName}`);
    initParams.push(`new ${config.names.dbClientClassName}()`);
  }

  imports.push(`import { ${config.names.requestDtoName}, ${config.names.responseDtoName} } from "../dtos/${config.names.dtoFileName.replace('.ts', '.js')}";`);

  // Build method body
  let methodBody = `    // TODO: Implement business logic\n`;
  if (config.addHttp || config.addDb) {
    const clientVar = config.addHttp ? 'this.httpClient' : 'this.dbClient'; 
    methodBody += `    const result = await ${clientVar}.${config.clientMethodName}(dto);\n    return result;`;
  } else {
    methodBody += `    return null;`;
  }

  const content = `
${imports.join('\n')}

export class ${config.names.serviceClassName} {
  constructor(${ctorParams.join(', ')}) {}

  async ${config.serviceMethodName}(dto: ${config.names.requestDtoName}): Promise<${config.names.responseDtoName} | null> {
${methodBody}
  }
}

export default new ${config.names.serviceClassName}(${initParams.join(', ')});
`;

  const filePath = path.join(config.paths.services, config.names.serviceFileName);
  fs.writeFileSync(filePath, content.trim());
  console.log(`[CREATE] Service: services/${config.names.serviceFileName}`);
};

execute(rl, "MCP Domain Generator", async () => {
  const inputs = await loadInputs();
  const config = createDomainConfig(inputs);
  
  createDirectories(config);
  createDtoFile(config);
  createUtilsFile(config);
  createHttpClientFile(config);
  createDbClientFile(config);
  createServiceFile(config);

  endMessage();
});

