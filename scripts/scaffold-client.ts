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
  execute,
  DomainInfo
} from './utils.js';

const rl = getReadLineInterface();

// --- Types ---

interface RawInputs {
  domainIdxRaw: string;
  typeRaw: string;
  nameRaw: string;
  methodRaw: string;
  availableDomains: DomainInfo[];
}

interface ClientConfig {
  domain: DomainInfo;
  isHttp: boolean;
  clientName: string; // kebab-case
  methodName: string; // camelCase
  classNamePrefix: string; // PascalCase
  clientsDir: string;
}

// --- Helper Functions ---

/**
 * Retrieves unique domains from the services map
 */
const getUniqueDomains = (): DomainInfo[] => {
  return Array.from(
    new Map(getDomainsServicesWithDomainMap().map((item) => [item.dirName, item])).values()
  );
};

/**
 * Generates the utility API file required for HTTP clients if it doesn't exist
 */
const ensureUtilsApi = (domainDirName: string) => {
  const utilsDir = path.resolve('src/domain', domainDirName, 'utils');
  const apiFile = path.join(utilsDir, 'api.ts');

  if (!fs.existsSync(utilsDir)) {
    fs.mkdirSync(utilsDir, { recursive: true });
  }

  if (!fs.existsSync(apiFile)) {
    const content = `
import env from "../../../env.js";

export function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  // headers["Authorization"] = env.API.headers.ApiKey;
  return headers;
}
`;
    fs.writeFileSync(apiFile, content.trim());
    console.log(`[INFO] Created missing utils/api.ts for HTTP client.`);
  }
};

// --- Execution Steps ---

const loadInputs = async (): Promise<RawInputs> => {
  // 1. List Domains
  const availableDomains = getUniqueDomains();

  if (availableDomains.length === 0) {
    throw new Error("No domains found. Please run 'npm run new-domain'");
  }

  console.log("Available Domains:");
  availableDomains.forEach((d, i) => console.log(`  [${i + 1}] ${d.dirName}`));

  const domainIdxRaw = await askQuestion(rl, "\nSelect Domain (number): ");

  // 2. Client Type
  console.log("\nClient Type:");
  console.log("  [1] HTTP Client");
  console.log("  [2] DB Client");

  const typeRaw = (await askQuestion(rl, "Select type (number): ")).trim();

  // 3. Client Name
  const isHttp = typeRaw === '1';
  const nameRaw = (await askQuestion(rl, `\nClient Name (kebab-case, e.g., ${isHttp ? 'weather-api' : 'postgres-db'}): `)).trim();

  // 4. Method Name
  const defaultMethod = isHttp ? 'fetchData' : 'getData';
  const methodRaw = (await askQuestion(rl, `Method Name (Hit enter to skip) (camelCase, default: ${defaultMethod}): `)).trim();

  return { domainIdxRaw, typeRaw, nameRaw, methodRaw, availableDomains };
};

const transformInputs = (inputs: RawInputs): ClientConfig => {
  // Validate Domain Selection
  const domainIdx = parseInt(inputs.domainIdxRaw.trim()) - 1;
  if (isNaN(domainIdx) || !inputs.availableDomains[domainIdx]) {
    throw new Error("Invalid domain selection.");
  }
  const domain = inputs.availableDomains[domainIdx];

  // Validate Type
  const isHttp = inputs.typeRaw === '1';
  const isDb = inputs.typeRaw === '2';
  if (!isHttp && !isDb) {
    throw new Error("Invalid client type.");
  }

  // Validate Name
  if (!inputs.nameRaw) {
    throw new Error("Client name is required.");
  }
  const clientName = toKebabCase(inputs.nameRaw);

  // Process Method Name
  const defaultMethod = isHttp ? 'fetchData' : 'getData';
  const methodName = inputs.methodRaw ? toCamelCase(inputs.methodRaw) : defaultMethod;

  const classNamePrefix = toPascalCase(clientName);
  
  // Construct path based on domain directory name, not the service file path
  const clientsDir = path.resolve('src/domain', domain.dirName, 'clients');

  return {
    domain,
    isHttp,
    clientName,
    methodName,
    classNamePrefix,
    clientsDir
  };
};

const generateClientFile = (config: ClientConfig) => {
  // Ensure clients directory exists
  if (!fs.existsSync(config.clientsDir)) {
    fs.mkdirSync(config.clientsDir, { recursive: true });
  }

  if (config.isHttp) {
    // 1. HTTP Client Generation
    ensureUtilsApi(config.domain.dirName);

    const className = `${config.classNamePrefix}HttpClient`;
    const fileName = `${config.clientName}.http.client.ts`;
    const fullPath = path.join(config.clientsDir, fileName);

    const content = `
import HttpClient from "../../../api/client.js";
import env from "../../../env.js";
import { getHeaders } from "../utils/api.js";

export class ${className} {
  private readonly httpClient: HttpClient;

  constructor() {
    this.httpClient = new HttpClient(env.API.Url, getHeaders());
  }

  async ${config.methodName}(dto: any): Promise<any> {
    // TODO: Define DTOs for dto and return type
    // return this.httpClient.post("/", dto);
    return null;
  }
}
`;
    fs.writeFileSync(fullPath, content.trim());
    console.log(`\n[CREATE] HTTP Client: ${fullPath}`);

  } else {
    // 2. DB Client Generation
    const className = `${config.classNamePrefix}DbClient`;
    const fileName = `${config.clientName}.db.client.ts`;
    const fullPath = path.join(config.clientsDir, fileName);

    const content = `
export class ${className} {
  async ${config.methodName}(id: string): Promise<any | null> {
    // TODO: Implement database logic
    return null;
  }
}
`;
    fs.writeFileSync(fullPath, content.trim());
    console.log(`\n[CREATE] DB Client: ${fullPath}`);
  }
};

execute(rl, "MCP Client Generator", async () => {
  const rawInputs = await loadInputs();
  const config = transformInputs(rawInputs);
  generateClientFile(config);
  logEndBanner("Client");
});