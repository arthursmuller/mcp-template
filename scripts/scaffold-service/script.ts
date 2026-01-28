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
  
  // Client selection data
  dbClientSelection: {
    choice: string;
    newName?: string;
    existingClients: ClientInfo[];
  };
  httpClientSelection: {
    choice: string;
    newName?: string;
    existingClients: ClientInfo[];
  };
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

const transformInputs = (inputs: RawInputs): ServiceConfig => {
  const { domain, serviceNameRaw, methodNameRaw, dbClientSelection, httpClientSelection } = inputs;

  // Service Names
  const serviceNameKebab = toKebabCase(serviceNameRaw);
  const serviceClassName = `${toPascalCase(serviceNameKebab)}Service`;
  const serviceFileName = `${serviceNameKebab}.service.ts`;

  // Method & DTO Names
  let methodName = '';
  let requestDtoName = '';
  let responseDtoName = '';
  let dtoFileName = '';

  if (methodNameRaw) {
    methodName = toCamelCase(methodNameRaw);
    const methodPascal = toPascalCase(methodName);
    requestDtoName = `${methodPascal}RequestDto`;
    responseDtoName = `${methodPascal}ResponseDto`;
    dtoFileName = `${methodName}.dto.ts`;
  }

  // Resolve DB Client
  let dbClient: ClientInfo | null = null;
  if (dbClientSelection.choice === '2' && dbClientSelection.newName) {
    const nameKebab = toKebabCase(dbClientSelection.newName);
    const fileName = `${nameKebab}.db.client.ts`;
    dbClient = {
      fileName,
      className: `${toPascalCase(nameKebab)}DbClient`,
      importPath: `../clients/${fileName.replace('.ts', '.js')}`,
      isNew: true
    };
  } else if (parseInt(dbClientSelection.choice) >= 3) {
    dbClient = dbClientSelection.existingClients[parseInt(dbClientSelection.choice) - 3];
  }

  // Resolve HTTP Client
  let httpClient: ClientInfo | null = null;
  if (httpClientSelection.choice === '2' && httpClientSelection.newName) {
    const nameKebab = toKebabCase(httpClientSelection.newName);
    const fileName = `${nameKebab}.http.client.ts`;
    httpClient = {
      fileName,
      className: `${toPascalCase(nameKebab)}HttpClient`,
      importPath: `../clients/${fileName.replace('.ts', '.js')}`,
      isNew: true
    };
  } else if (parseInt(httpClientSelection.choice) >= 3) {
    httpClient = httpClientSelection.existingClients[parseInt(httpClientSelection.choice) - 3];
  }

  return {
    domainRoot: domain.rootPath,
    serviceFileName,
    serviceClassName,
    methodName,
    requestDtoName,
    responseDtoName,
    dtoFileName,
    dbClient,
    httpClient
  };
};

const generateFiles = (config: ServiceConfig) => {
  console.log("\n[INFO] Generating files...\n");

  const { 
    domainRoot, 
    serviceFileName, 
    serviceClassName, 
    methodName, 
    requestDtoName, 
    responseDtoName, 
    dtoFileName, 
    dbClient, 
    httpClient 
  } = config;

  // 1. Create DTO if requested
  if (methodName && dtoFileName) {
    const dtoPath = path.join(domainRoot, 'dtos', dtoFileName);
    const dtoContent = `export interface ${requestDtoName} {\n  // TODO: Add properties\n}\n\nexport interface ${responseDtoName} {\n  // TODO: Add properties\n}\n`;
    
    if (!fs.existsSync(path.dirname(dtoPath))) fs.mkdirSync(path.dirname(dtoPath), { recursive: true });
    fs.writeFileSync(dtoPath, dtoContent);
    console.log(`[CREATE] DTO: ${dtoPath}`);
  }

  // 2. Create Clients if New
  const clientsDir = path.join(domainRoot, 'clients');
  if (!fs.existsSync(clientsDir)) fs.mkdirSync(clientsDir, { recursive: true });

  if (dbClient && dbClient.isNew) {
    const clientPath = path.join(clientsDir, dbClient.fileName);
    const content = `
export class ${dbClient.className} {
  // TODO: Implement DB logic
}
`;
    fs.writeFileSync(clientPath, content.trim());
    console.log(`[CREATE] DB Client: ${clientPath}`);
  }

  if (httpClient && httpClient.isNew) {
    const clientPath = path.join(clientsDir, httpClient.fileName);
    const content = `
import HttpClient from "../../../api/client.js";
import env from "../../../env.js";
import { getHeaders } from "../utils/api.js";

export class ${httpClient.className} {
  private readonly httpClient: HttpClient;

  constructor() {
    this.httpClient = new HttpClient(env.API.Url, getHeaders())
  }
  
  // TODO: Implement HTTP logic
}
`;
    fs.writeFileSync(clientPath, content.trim());
    console.log(`[CREATE] HTTP Client: ${clientPath}`);
  }

  // 3. Create Service
  const servicesDir = path.join(domainRoot, 'services');
  if (!fs.existsSync(servicesDir)) fs.mkdirSync(servicesDir, { recursive: true });

  const servicePath = path.join(servicesDir, serviceFileName);
  
  // Imports
  const imports: string[] = [];
  if (dbClient) imports.push(`import { ${dbClient.className} } from "${dbClient.importPath}";`);
  if (httpClient) imports.push(`import { ${httpClient.className} } from "${httpClient.importPath}";`);
  if (methodName) imports.push(`import { ${requestDtoName}, ${responseDtoName} } from "../dtos/${dtoFileName?.replace('.ts', '.js')}";`);

  // Constructor Props
  const ctorParams: string[] = [];
  if (dbClient) ctorParams.push(`private readonly dbClient: ${dbClient.className}`);
  if (httpClient) ctorParams.push(`private readonly httpClient: ${httpClient.className}`);

  // Method Implementation
  let methodImpl = '';
  if (methodName) {
    methodImpl = `
  async ${methodName}(dto: ${requestDtoName}): Promise<${responseDtoName} | null> {
    // TODO: Implement logic
    return null;
  }
`;
  }

  // Default Export Instantiation
  const newParams: string[] = [];
  if (dbClient) newParams.push(`new ${dbClient.className}()`);
  if (httpClient) newParams.push(`new ${httpClient.className}()`);

  const serviceContent = `
${imports.join('\n')}

export class ${serviceClassName} {
  constructor(${ctorParams.join(', ')}) {}
${methodImpl}
}

export default new ${serviceClassName}(${newParams.join(', ')});
`;

  fs.writeFileSync(servicePath, serviceContent.trim());
  console.log(`[CREATE] Service: ${servicePath}`);
};

// --- Run ---

execute(rl, "MCP Service Generator", async () => {
  const inputs = await loadInputs();
  const config = transformInputs(inputs);
  generateFiles(config);
  logEndBanner("Service");
});