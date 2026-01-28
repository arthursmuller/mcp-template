import * as fs from 'fs';
import * as path from 'path';
import { 
  askQuestion,
  getDomainsServicesWithDomainMap,
  getReadLineInterface,
  toPascalCase,
  toKebabCase,
  toCamelCase,
  logEndBanner,
  execute
} from '../utils.js';

const rl = getReadLineInterface();

// --- Types ---

interface ClientInfo {
  fileName: string;
  className: string;
  importPath: string; // relative to service file
  isNew?: boolean;
}

interface DomainData {
  dirName: string;
  rootPath: string;
}

interface RawInputs {
  domain: DomainData;
  serviceNameRaw: string;
  methodNameRaw: string;
  
  dbClientSelection: ClientSelectionInput;
  httpClientSelection: ClientSelectionInput;
}

interface ClientSelectionInput {
  choice: string;
  newName?: string;
  existingClients: ClientInfo[];
}

interface ServiceConfig {
  domainRoot: string;
  serviceFileName: string;
  serviceClassName: string;
  
  methodName: string;
  requestDtoName: string;
  responseDtoName: string;
  dtoFileName: string;
  
  dbClient: ClientInfo | null;
  httpClient: ClientInfo | null;
}

// --- Helpers ---

const getClients = (domainDir: string, type: 'db' | 'http'): ClientInfo[] => {
  const clientsDir = path.join(domainDir, 'clients');
  if (!fs.existsSync(clientsDir)) return [];

  const suffix = type === 'http' ? '.http.client.ts' : '.db.client.ts';
  const clients: ClientInfo[] = [];

  const files = fs.readdirSync(clientsDir);
  for (const file of files) {
    if (file.endsWith(suffix)) {
      const content = fs.readFileSync(path.join(clientsDir, file), 'utf8');
      const match = content.match(/export\s+class\s+(\w+)/);
      if (match && match[1]) {
        clients.push({
          fileName: file,
          className: match[1],
          importPath: `../clients/${file.replace('.ts', '.js')}`
        });
      }
    }
  }
  return clients;
};

const getAvailableDomains = (): DomainData[] => {
  const allServices = getDomainsServicesWithDomainMap();
  const domainsMap = new Map<string, DomainData>();
  
  for (const s of allServices) {
    // s.absolutePath is .../src/domain/<domain>/services/<service>.ts
    // We want .../src/domain/<domain>
    const domainRoot = path.resolve(path.dirname(s.absolutePath), '..');
    if (!domainsMap.has(s.dirName)) {
      domainsMap.set(s.dirName, { dirName: s.dirName, rootPath: domainRoot });
    }
  }
  return Array.from(domainsMap.values());
};

// --- Execution Steps ---

const loadInputs = async (): Promise<RawInputs> => {
  // 1. Select Domain
  const domains = getAvailableDomains();

  if (domains.length === 0) {
    throw new Error("No domains found. Please run startup-project first or create a domain manually.");
  }

  console.log("Available Domains:");
  domains.forEach((d, i) => console.log(`  [${i + 1}] ${d.dirName}`));
  
  const domainIdxRaw = await askQuestion(rl, "\nSelect Domain (number): ");
  const domainIdx = parseInt(domainIdxRaw.trim()) - 1;
  const selectedDomain = domains[domainIdx];

  if (!selectedDomain) {
    throw new Error("Invalid selection.");
  }

  const domainRoot = selectedDomain.rootPath;

  // 2. Service Details
  const serviceNameRaw = (await askQuestion(rl, "Service Name (kebab-case, e.g., user-profile): ")).trim();

  // 3. Method & DTO
  const methodNameRaw = (await askQuestion(rl, "Add a method name? (camelCase, e.g., getUser, or leave empty): ")).trim();

  // 4. DB Client
  const existingDbClients = getClients(domainRoot, 'db');
  console.log("\n--- DB Client Dependency ---");
  console.log("  [1] None");
  console.log("  [2] Create New");
  existingDbClients.forEach((c, i) => console.log(`  [${i + 3}] Use Existing: ${c.className}`));
  
  const dbChoice = (await askQuestion(rl, "Select option: ")).trim();
  let dbNewName: string | undefined;
  if (dbChoice === '2') {
    dbNewName = (await askQuestion(rl, "New DB Client Name (kebab-case, e.g., user): ")).trim();
  }

  // 5. HTTP Client
  const existingHttpClients = getClients(domainRoot, 'http');
  console.log("\n--- HTTP Client Dependency ---");
  console.log("  [1] None");
  console.log("  [2] Create New");
  existingHttpClients.forEach((c, i) => console.log(`  [${i + 3}] Use Existing: ${c.className}`));
  
  const httpChoice = (await askQuestion(rl, "Select option: ")).trim();
  let httpNewName: string | undefined;
  if (httpChoice === '2') {
    httpNewName = (await askQuestion(rl, "New HTTP Client Name (kebab-case, e.g., weather): ")).trim();
  }

  return {
    domain: selectedDomain,
    serviceNameRaw,
    methodNameRaw,
    dbClientSelection: {
      choice: dbChoice,
      newName: dbNewName,
      existingClients: existingDbClients
    },
    httpClientSelection: {
      choice: httpChoice,
      newName: httpNewName,
      existingClients: existingHttpClients
    }
  };
};

const resolveClient = (selection: ClientSelectionInput, type: 'db' | 'http'): ClientInfo | null => {
  if (selection.choice === '2' && selection.newName) {
    const nameKebab = toKebabCase(selection.newName);
    const suffix = type === 'http' ? '.http.client.ts' : '.db.client.ts';
    const fileName = `${nameKebab}${suffix}`;
    const classSuffix = type === 'http' ? 'HttpClient' : 'DbClient';
    
    return {
      fileName,
      className: `${toPascalCase(nameKebab)}${classSuffix}`,
      importPath: `../clients/${fileName.replace('.ts', '.js')}`,
      isNew: true
    };
  } else if (parseInt(selection.choice) >= 3) {
    return selection.existingClients[parseInt(selection.choice) - 3];
  }
  return null;
};

const transformInputs = (inputs: RawInputs): ServiceConfig => {
  const { domain, serviceNameRaw, methodNameRaw, dbClientSelection, httpClientSelection } = inputs;

  const serviceNameKebab = toKebabCase(serviceNameRaw);
  
  const config: ServiceConfig = {
    domainRoot: domain.rootPath,
    serviceFileName: `${serviceNameKebab}.service.ts`,
    serviceClassName: `${toPascalCase(serviceNameKebab)}Service`,
    methodName: '',
    requestDtoName: '',
    responseDtoName: '',
    dtoFileName: '',
    dbClient: resolveClient(dbClientSelection, 'db'),
    httpClient: resolveClient(httpClientSelection, 'http')
  };

  if (methodNameRaw) {
    const methodName = toCamelCase(methodNameRaw);
    const methodPascal = toPascalCase(methodName);
    config.methodName = methodName;
    config.requestDtoName = `${methodPascal}RequestDto`;
    config.responseDtoName = `${methodPascal}ResponseDto`;
    config.dtoFileName = `${methodName}.dto.ts`;
  }

  return config;
};

const createDtoFile = (config: ServiceConfig) => {
  if (!config.methodName || !config.dtoFileName) return;

  const dtoPath = path.join(config.domainRoot, 'dtos', config.dtoFileName);
  const dtoContent = `export interface ${config.requestDtoName} {\n  // TODO: Add properties\n}\n\nexport interface ${config.responseDtoName} {\n  // TODO: Add properties\n}\n`;
  
  if (!fs.existsSync(path.dirname(dtoPath))) fs.mkdirSync(path.dirname(dtoPath), { recursive: true });
  fs.writeFileSync(dtoPath, dtoContent);
  console.log(`[CREATE] DTO: ${dtoPath}`);
};

const createDbClientFile = (config: ServiceConfig) => {
  if (!config.dbClient || !config.dbClient.isNew) return;

  const clientsDir = path.join(config.domainRoot, 'clients');
  if (!fs.existsSync(clientsDir)) fs.mkdirSync(clientsDir, { recursive: true });

  const clientPath = path.join(clientsDir, config.dbClient.fileName);
  const content = `
export class ${config.dbClient.className} {
  // TODO: Implement DB logic
}
`;
  fs.writeFileSync(clientPath, content.trim());
  console.log(`[CREATE] DB Client: ${clientPath}`);
};

const createHttpClientFile = (config: ServiceConfig) => {
  if (!config.httpClient || !config.httpClient.isNew) return;

  const clientsDir = path.join(config.domainRoot, 'clients');
  if (!fs.existsSync(clientsDir)) fs.mkdirSync(clientsDir, { recursive: true });

  const clientPath = path.join(clientsDir, config.httpClient.fileName);
  const content = `
import HttpClient from "../../../api/client.js";
import env from "../../../env.js";
import { getHeaders } from "../utils/api.js";

export class ${config.httpClient.className} {
  private readonly httpClient: HttpClient;

  constructor() {
    this.httpClient = new HttpClient(env.API.Url, getHeaders())
  }
  
  // TODO: Implement HTTP logic
}
`;
  fs.writeFileSync(clientPath, content.trim());
  console.log(`[CREATE] HTTP Client: ${clientPath}`);
};

const createServiceFile = (config: ServiceConfig) => {
  const servicesDir = path.join(config.domainRoot, 'services');
  if (!fs.existsSync(servicesDir)) fs.mkdirSync(servicesDir, { recursive: true });

  const servicePath = path.join(servicesDir, config.serviceFileName);
  
  // Imports
  const imports: string[] = [];
  if (config.dbClient) imports.push(`import { ${config.dbClient.className} } from "${config.dbClient.importPath}";`);
  if (config.httpClient) imports.push(`import { ${config.httpClient.className} } from "${config.httpClient.importPath}";`);
  if (config.methodName) imports.push(`import { ${config.requestDtoName}, ${config.responseDtoName} } from "../dtos/${config.dtoFileName.replace('.ts', '.js')}";`);

  // Constructor Props
  const ctorParams: string[] = [];
  if (config.dbClient) ctorParams.push(`private readonly dbClient: ${config.dbClient.className}`);
  if (config.httpClient) ctorParams.push(`private readonly httpClient: ${config.httpClient.className}`);

  // Method Implementation
  let methodImpl = '';
  if (config.methodName) {
    methodImpl = `
  async ${config.methodName}(dto: ${config.requestDtoName}): Promise<${config.responseDtoName} | null> {
    // TODO: Implement logic
    return null;
  }
`;
  }

  // Default Export Instantiation
  const newParams: string[] = [];
  if (config.dbClient) newParams.push(`new ${config.dbClient.className}()`);
  if (config.httpClient) newParams.push(`new ${config.httpClient.className}()`);

  const serviceContent = `
${imports.join('\n')}

export class ${config.serviceClassName} {
  constructor(${ctorParams.join(', ')}) {}
${methodImpl}
}

export default new ${config.serviceClassName}(${newParams.join(', ')});
`;

  fs.writeFileSync(servicePath, serviceContent.trim());
  console.log(`[CREATE] Service: ${servicePath}`);
};

const generateFiles = (config: ServiceConfig) => {
  console.log("\n[INFO] Generating files...\n");
  createDtoFile(config);
  createDbClientFile(config);
  createHttpClientFile(config);
  createServiceFile(config);
};

// --- Run ---

execute(rl, "MCP Service Generator", async () => {
  const inputs = await loadInputs();
  const config = transformInputs(inputs);
  generateFiles(config);
  logEndBanner("Service");
});