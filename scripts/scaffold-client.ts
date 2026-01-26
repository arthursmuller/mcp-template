import * as fs from 'fs';
import * as path from 'path';
import { askQuestion, getDomainsServicesWithDomainMap, rl } from './utils.js';

// --- Helpers ---
const toPascalCase = (str: string): string => {
  return str.split(/[-_.]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
};

const ensureUtilsApi = (domainPath: string) => {
  const utilsDir = path.join(domainPath, 'utils');
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

// --- Main Script ---
async function main() {
  console.log("=====================================");
  console.log("     MCP Client Generator            ");
  console.log("=====================================\n");

  // 1. List Domains
  const domains = Array.from(
    new Map(getDomainsServicesWithDomainMap().map((item) => [item.dirName, item])).values()
  );

  if (domains.length === 0) {
    console.error("No domains found. Please run 'npm run new-domain'");
    process.exit(0);
  }

  console.log("Available Domains:");
  domains.forEach((d, i) => console.log(`  [${i + 1}] ${d.dirName}`));

  const domainIdxRaw = await askQuestion("\nSelect Domain (number): ");
  const domainIdx = parseInt(domainIdxRaw.trim()) - 1;

  if (isNaN(domainIdx) || !domains[domainIdx]) {
    console.error("Invalid selection.");
    process.exit(1);
  }

  const selectedDomain = domains[domainIdx];

  // 2. Client Type
  console.log("\nClient Type:");
  console.log("  [1] HTTP Client");
  console.log("  [2] DB Client");

  const typeRaw = (await askQuestion("Select type (number): ")).trim();
  const isHttp = typeRaw === '1';
  const isDb = typeRaw === '2';

  if (!isHttp && !isDb) {
    console.error("Invalid client type.");
    process.exit(1);
  }

  // 3. Client Name
  const nameRaw = (await askQuestion(`\nClient Name (kebab-case, e.g., ${isHttp ? 'weather-api' : 'postgres-db'}): `)).trim();
  if (!nameRaw) {
    console.error("Client name is required.");
    process.exit(1);
  }

  // 4. Method Name (Optional)
  const defaultMethod = isHttp ? 'fetchData' : 'getData';
  const methodRaw = (await askQuestion(`Method Name (Hit enter to skip) (camelCase, default: ${defaultMethod}): `)).trim();
  const methodName = methodRaw || defaultMethod;

  const classNamePrefix = toPascalCase(nameRaw);
  const fileNamePrefix = nameRaw.toLowerCase();
  
  const clientsDir = path.join(selectedDomain.absolutePath, 'clients');
  if (!fs.existsSync(clientsDir)) {
    fs.mkdirSync(clientsDir, { recursive: true });
  }

  // 5. Generate Files
  if (isHttp) {
    // Ensure utils exist for HTTP
    ensureUtilsApi(selectedDomain.absolutePath);

    const className = `${classNamePrefix}HttpClient`;
    const fileName = `${fileNamePrefix}.http.client.ts`;
    const fullPath = path.join(clientsDir, fileName);

    const content = `
import HttpClient from "../../../api/client.js";
import { getHeaders } from "../utils/api.js";

export class ${className} {
  private readonly httpClient: HttpClient;

  constructor() {
    this.httpClient = new HttpClient(getHeaders());
  }

  async ${methodName}(dto: any): Promise<any> {
    // TODO: Define DTOs for dto and return type
    // return this.httpClient.post("/", dto);
    return null;
  }
}
`;
    fs.writeFileSync(fullPath, content.trim());
    console.log(`\n[CREATE] HTTP Client: ${fullPath}`);
  } else {
    // DB Client
    const className = `${classNamePrefix}DbClient`;
    const fileName = `${fileNamePrefix}.db.client.ts`;
    const fullPath = path.join(clientsDir, fileName);

    const content = `
export class ${className} {
  async ${methodName}(id: string): Promise<any | null> {
    // TODO: Implement database logic
    return null;
  }
}
`;
    fs.writeFileSync(fullPath, content.trim());
    console.log(`\n[CREATE] DB Client: ${fullPath}`);
  }

  console.log("\n=====================================");
  console.log("   Client Created Successfully! 🚀");
  console.log("=====================================");
  
  rl.close();
}

main().catch(err => {
  console.error(err);
  rl.close();
  process.exit(1);
});