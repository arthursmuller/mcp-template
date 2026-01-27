import * as fs from 'fs';
import * as path from 'path';
import { logBanner, askQuestion, getDomainsServicesWithDomainMap, getReadLineInterface, toPascalCase, toKebabCase, toCamelCase, logEndBanner } from './utils.js';

const rl = getReadLineInterface();

interface ClientInfo {
  fileName: string;
  className: string;
  importPath: string; // relative to service file
  isNew?: boolean;
}

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

async function main() {
  logBanner("MCP Service Generator")

  // 1. Select distinct Domains
  // getDomainsServicesWithDomainMap returns individual service files. We group them by domain directory.
  const allServices = getDomainsServicesWithDomainMap();
  const domainsMap = new Map<string, { dirName: string, rootPath: string }>();
  
  for (const s of allServices) {
    // s.absolutePath is .../src/domain/<domain>/services/<service>.ts
    // We want .../src/domain/<domain>
    const domainRoot = path.resolve(path.dirname(s.absolutePath), '..');
    if (!domainsMap.has(s.dirName)) {
      domainsMap.set(s.dirName, { dirName: s.dirName, rootPath: domainRoot });
    }
  }

  const domains = Array.from(domainsMap.values());

  if (domains.length === 0) {
    console.error("[mn] No domains found. Please run startup-project first or create a domain manually.");
    process.exit(1);
  }

  console.log("Available Domains:");
  domains.forEach((d, i) => console.log(`  [${i + 1}] ${d.dirName}`));
  
  const domainIdx = await askQuestion(rl, "\nSelect Domain (number): ");
  const selectedDomain = domains[parseInt(domainIdx.trim()) - 1];

  if (!selectedDomain) {
    console.error("Invalid selection.");
    process.exit(1);
  }

  const domainRoot = selectedDomain.rootPath;

  // 2. Service Details
  const serviceNameRaw = (await askQuestion(rl, "Service Name (kebab-case, e.g., user-profile): ")).trim();
  const serviceNameKebab = toKebabCase(serviceNameRaw);
  const serviceClassName = `${toPascalCase(serviceNameKebab)}Service`;
  const serviceFileName = `${serviceNameKebab}.service.ts`;

  // 3. Method & DTO
  const methodNameRaw = (await askQuestion(rl, "Add a method name? (camelCase, e.g., getUser, or leave empty): ")).trim();
  let methodName = '';
  let requestDtoName = '';
  let responseDtoName = '';
  let dtoFileName = '';

  if (methodNameRaw) {
    methodName = toCamelCase(methodNameRaw);
    const methodPascal = toPascalCase(methodName);
    requestDtoName = `${methodPascal}RequestDto`;
    responseDtoName = `${methodPascal}ResponseDto`;
    dtoFileName = `${methodName}.dto.ts`; // Filename based on method name as per convention
  }

  // 4. Client Dependencies
  
  // --- DB Client ---
  let dbClient: ClientInfo | null = null;
  const existingDbClients = getClients(domainRoot, 'db');
  
  console.log("\n--- DB Client Dependency ---");
  console.log("  [1] None");
  console.log("  [2] Create New");
  existingDbClients.forEach((c, i) => console.log(`  [${i + 3}] Use Existing: ${c.className}`));
  
  const dbChoice = (await askQuestion(rl, "Select option: ")).trim();
  
  if (dbChoice === '2') {
    const nameRaw = (await askQuestion(rl, "New DB Client Name (kebab-case, e.g., user): ")).trim();
    const nameKebab = toKebabCase(nameRaw);
    const className = `${toPascalCase(nameKebab)}DbClient`;
    const fileName = `${nameKebab}.db.client.ts`;
    dbClient = {
      fileName,
      className,
      importPath: `../clients/${fileName.replace('.ts', '.js')}`,
      isNew: true
    };
  } else if (parseInt(dbChoice) >= 3) {
    dbClient = existingDbClients[parseInt(dbChoice) - 3];
  }

  // --- HTTP Client ---
  let httpClient: ClientInfo | null = null;
  const existingHttpClients = getClients(domainRoot, 'http');
  
  console.log("\n--- HTTP Client Dependency ---");
  console.log("  [1] None");
  console.log("  [2] Create New");
  existingHttpClients.forEach((c, i) => console.log(`  [${i + 3}] Use Existing: ${c.className}`));
  
  const httpChoice = (await askQuestion(rl, "Select option: ")).trim();

  if (httpChoice === '2') {
    const nameRaw = (await askQuestion(rl, "New HTTP Client Name (kebab-case, e.g., weather): ")).trim();
    const nameKebab = toKebabCase(nameRaw);
    const className = `${toPascalCase(nameKebab)}HttpClient`;
    const fileName = `${nameKebab}.http.client.ts`;
    httpClient = {
      fileName,
      className,
      importPath: `../clients/${fileName.replace('.ts', '.js')}`,
      isNew: true
    };
  } else if (parseInt(httpChoice) >= 3) {
    httpClient = existingHttpClients[parseInt(httpChoice) - 3];
  }

  console.log("\n[INFO] Generating files...\n");

  // --- File Generation ---

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

  logEndBanner("Service");
  
  rl.close();
}

main().catch(err => {
  console.error(err);
  rl.close();
  process.exit(1);
});