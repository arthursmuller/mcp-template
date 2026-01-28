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
} from '../utils.js';

const rl = getReadLineInterface();

// --- Constants & Types ---

const CLIENT_TYPE = {
  HTTP: '1',
  DB: '2'
} as const;

interface RawInputs {
  domainIdxRaw: string;
  typeRaw: string;
  nameRaw: string;
  methodRaw: string;
  availableDomains: DomainInfo[];
}

interface ClientConfig {
  domain: DomainInfo;
  type: typeof CLIENT_TYPE[keyof typeof CLIENT_TYPE]; // '1' | '2'
  clientNameKebab: string; 
  methodNameCamel: string; 
  classNamePrefix: string; 
  clientsDir: string;
}

// --- Logic Flow ---

/**
 * Step 1: Gather all necessary inputs from the user via CLI.
 */
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
  console.log(`  [${CLIENT_TYPE.HTTP}] HTTP Client`);
  console.log(`  [${CLIENT_TYPE.DB}] DB Client`);

  const typeRaw = (await askQuestion(rl, "Select type (number): ")).trim();

  // 3. Client Name
  const isHttp = typeRaw === CLIENT_TYPE.HTTP;
  const exampleName = isHttp ? 'weather-api' : 'postgres-db';
  const nameRaw = (await askQuestion(rl, `\nClient Name (kebab-case, e.g., ${exampleName}): `)).trim();

  // 4. Method Name
  const defaultMethod = isHttp ? 'fetchData' : 'getData';
  const methodRaw = (await askQuestion(rl, `Method Name (Hit enter to skip) (camelCase, default: ${defaultMethod}): `)).trim();

  return { domainIdxRaw, typeRaw, nameRaw, methodRaw, availableDomains };
};

/**
 * Step 2: Validate inputs and transform them into a configuration object.
 */
const transformInputs = (inputs: RawInputs): ClientConfig => {
  // Validate Domain
  const domainIdx = parseInt(inputs.domainIdxRaw.trim()) - 1;
  if (isNaN(domainIdx) || !inputs.availableDomains[domainIdx]) {
    throw new Error("Invalid domain selection.");
  }
  const domain = inputs.availableDomains[domainIdx];

  // Validate Type
  if (inputs.typeRaw !== CLIENT_TYPE.HTTP && inputs.typeRaw !== CLIENT_TYPE.DB) {
    throw new Error("Invalid client type.");
  }

  // Validate Name
  if (!inputs.nameRaw) {
    throw new Error("Client name is required.");
  }
  const clientNameKebab = toKebabCase(inputs.nameRaw);

  // Process Method Name
  const defaultMethod = inputs.typeRaw === CLIENT_TYPE.HTTP ? 'fetchData' : 'getData';
  const methodNameCamel = inputs.methodRaw ? toCamelCase(inputs.methodRaw) : defaultMethod;

  const classNamePrefix = toPascalCase(clientNameKebab);
  
  // Construct output directory path
  const clientsDir = path.resolve('src/domain', domain.dirName, 'clients');

  return {
    domain,
    type: inputs.typeRaw as ClientConfig['type'],
    clientNameKebab,
    methodNameCamel,
    classNamePrefix,
    clientsDir
  };
};

/**
 * Step 3: Generate the files based on the configuration.
 */
const generateClientFiles = (config: ClientConfig) => {
  ensureDirectoryExists(config.clientsDir);

  if (config.type === CLIENT_TYPE.HTTP) {
    generateHttpClient(config);
  } else {
    generateDbClient(config);
  }
};

// --- Generators ---

const generateHttpClient = (config: ClientConfig) => {
  // HTTP Clients require a shared utility file
  ensureUtilsApi(config.domain.dirName);

  const className = `${config.classNamePrefix}HttpClient`;
  const fileName = `${config.clientNameKebab}.http.client.ts`;
  const fullPath = path.join(config.clientsDir, fileName);

  const content = getHttpClientTemplate(className, config.methodNameCamel);

  fs.writeFileSync(fullPath, content.trim());
  console.log(`\n[CREATE] HTTP Client: ${fullPath}`);
};

const generateDbClient = (config: ClientConfig) => {
  const className = `${config.classNamePrefix}DbClient`;
  const fileName = `${config.clientNameKebab}.db.client.ts`;
  const fullPath = path.join(config.clientsDir, fileName);

  const content = getDbClientTemplate(className, config.methodNameCamel);

  fs.writeFileSync(fullPath, content.trim());
  console.log(`\n[CREATE] DB Client: ${fullPath}`);
};

// --- Helpers ---

const getUniqueDomains = (): DomainInfo[] => {
  return Array.from(
    new Map(getDomainsServicesWithDomainMap().map((item) => [item.dirName, item])).values()
  );
};

const ensureDirectoryExists = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Generates the utility API file required for HTTP clients if it doesn't exist.
 */
const ensureUtilsApi = (domainDirName: string) => {
  const utilsDir = path.resolve('src/domain', domainDirName, 'utils');
  const apiFile = path.join(utilsDir, 'api.ts');

  ensureDirectoryExists(utilsDir);

  if (!fs.existsSync(apiFile)) {
    const content = getApiUtilsTemplate();
    fs.writeFileSync(apiFile, content.trim());
    console.log(`[INFO] Created missing utils/api.ts for HTTP client.`);
  }
};

// --- Templates ---

const getHttpClientTemplate = (className: string, methodName: string) => `
import HttpClient from "../../../api/client.js";
import env from "../../../env.js";
import { getHeaders } from "../utils/api.js";

export class ${className} {
  private readonly httpClient: HttpClient;

  constructor() {
    this.httpClient = new HttpClient(env.API.Url, getHeaders());
  }

  async ${methodName}(dto: any): Promise<any> {
    // TODO: Define DTOs for dto and return type
    // return this.httpClient.post("/", dto);
    return null;
  }
}
`;

const getDbClientTemplate = (className: string, methodName: string) => `
export class ${className} {
  async ${methodName}(id: string): Promise<any | null> {
    // TODO: Implement database logic
    return null;
  }
}
`;

const getApiUtilsTemplate = () => `
import env from "../../../env.js";

export function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  // headers["Authorization"] = env.API.headers.ApiKey;
  return headers;
}
`;

// --- Execution ---

execute(rl, "MCP Client Generator", async () => {
  const rawInputs = await loadInputs();
  const config = transformInputs(rawInputs);
  generateClientFiles(config);
  logEndBanner("Client");
});