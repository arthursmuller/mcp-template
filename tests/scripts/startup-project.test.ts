import * as fs from 'fs';
import * as path from 'path';
import { MockFileSystem, abs } from '../utils/file-system.js';

import * as mockUtils from '../mocks/utils.js';

jest.mock('../../scripts/utils.js', () => mockUtils);
jest.mock('fs');

// --- Original File Content Constants ---

// FIX: Escaped the backslash in the regex replace call: replace(/\\/$/, "") 
// This ensures the string contains "replace(/\/$/, "")" and satisfies ESLint.
const ENV_TS = `import toolMetadata from "./tools.metadata.js";

const env = {
  SERVER_NAME: "example-mcp-proj-name",
  TOOLS_ENABLED: [
    process.env.EXAMPLE_TOOL === "false" ? null : toolMetadata.example_tool.name,
  ].filter(element => element !== null),
  API: {
    Url: (() : string => {
      if (!process.env.API_URL) {
        throw new Error("API_URL environment variable is not defined");
      }

      return process.env.API_URL.replace(/\\/$/, "") ?? "";
    })(),
    headers: {
      Example: process.env.EXAMPLE_HEADER || "",
    }
  }
}

export default env;`;

const TOOLS_METADATA_TS = `const toolMetadata = {
  example_tool: {
    name: "example_tool",
    description: \`Example tool.\`,
  },
}

export default toolMetadata;`;

const MCP_TOOLS_TS = `import z from "zod";
import { ToolDefinition } from "./utils/dtos.js";
import toolMetadata from "../tools.metadata.js";
import buildTool from "./utils/newTool.js";
import DomainService from "../domain/domain-name/services/domain.service.js";

const tools: Record<string, ToolDefinition> = {
  [toolMetadata.example_tool.name]: {
    name: toolMetadata.example_tool.name,
    description: toolMetadata.example_tool.description,
    inputSchema: {
      exampleParam: z.string().describe(\`Example Tool param description\`),
    },
    callback: buildTool(DomainService.example.bind(DomainService)),
  },
}

export default tools;`;

const DOMAIN_DTO_TS = `export type DomainExampleResponseDto = {
  results: any[];
}

export interface DomainExampleRequestDto {
  exampleParam: string;
}`;

const DOMAIN_HTTP_CLIENT_TS = `import HttpClient from "../../../api/client.js";
import env from "../../../env.js";
import { DomainExampleRequestDto, DomainExampleResponseDto } from "../dtos/domain.dto.js";
import { getHeaders } from "../utils/api.js";

export class DomainHttpClient {
  private readonly httpClient: HttpClient
  constructor() {
    this.httpClient = new HttpClient(env.API.Url, getHeaders())
  }

  async example(dto: DomainExampleRequestDto): Promise<DomainExampleResponseDto | null> {
    try {
      const data = await this.httpClient.post<DomainExampleResponseDto>("/", { ...dto });
      return data;
    } catch (e) {
      console.error(\`Failed to execute query: \`, e);
      return null;
    }
  }
}`;

const DOMAIN_DB_CLIENT_TS = `import { DomainExampleRequestDto, DomainExampleResponseDto } from "../dtos/domain.dto.js";

export class DomainDbClient  {
  async example(_: DomainExampleRequestDto): Promise<DomainExampleResponseDto | null> {
    return null;
  }
}`;

const DOMAIN_SERVICE_TS = `import { DomainHttpClient } from "../clients/domain.http.client.js";
import { DomainExampleRequestDto, DomainExampleResponseDto } from "../dtos/domain.dto.js";

export class DomainService {
  constructor(private readonly httpClient: DomainHttpClient) { }

  async example(dto: DomainExampleRequestDto): Promise<DomainExampleResponseDto | null> {
    const data = await this.httpClient.example(dto);
    return data;
  }
}

export default new DomainService(new DomainHttpClient());`;


describe('Startup Project Script (Integration Test)', () => {
  const {  askQuestion: mockAskQuestion } = mockUtils as any;
  
  let mockFs: MockFileSystem;

  // Snapshot of the initial project structure
  const getBaseFileSystem = () => ({
    // Config & Meta
    [abs('package.json')]: JSON.stringify({
      name: "example-mcp-proj-name",
      description: "example-mcp-proj-name",
      scripts: { 
        "start": "node dist/index.js",
        "startup-project": "ts-node scripts/startup-project.ts" 
      }
    }, null, 2),
    [abs('package-lock.json')]: JSON.stringify({ name: "example-mcp-proj-name" }, null, 2),
    [abs('readme.md')]: "# example-mcp-proj-name MCP Server",
    [abs('src/env.ts')]: ENV_TS,
    [abs('src/tools.metadata.ts')]: TOOLS_METADATA_TS,
    
    // Directories
    [abs('src/domain/domain-name')]: 'DIRECTORY',
    [abs('src/domain/domain-name/dtos')]: 'DIRECTORY',
    [abs('src/domain/domain-name/clients')]: 'DIRECTORY',
    [abs('src/domain/domain-name/services')]: 'DIRECTORY',

    // Domain Files
    [abs('src/domain/domain-name/dtos/domain.dto.ts')]: DOMAIN_DTO_TS,
    [abs('src/domain/domain-name/clients/domain.db.client.ts')]: DOMAIN_DB_CLIENT_TS,
    [abs('src/domain/domain-name/clients/domain.http.client.ts')]: DOMAIN_HTTP_CLIENT_TS,
    [abs('src/domain/domain-name/services/domain.service.ts')]: DOMAIN_SERVICE_TS,
    
    // MCP Tools
    [abs('src/mcp/tools.ts')]: MCP_TOOLS_TS,
      
    // Script
    [abs(path.join('scripts', 'startup-project.ts'))]: 'console.log("running");'
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize VFS with base state
    mockFs = new MockFileSystem(getBaseFileSystem());

    // Wire up fs mocks to the shared MockFileSystem implementation
    (fs.existsSync as jest.Mock).mockImplementation(mockFs.existsSync);
    (fs.readFileSync as jest.Mock).mockImplementation(mockFs.readFileSync);
    (fs.writeFileSync as jest.Mock).mockImplementation(mockFs.writeFileSync);
    (fs.renameSync as jest.Mock).mockImplementation(mockFs.renameSync);
    (fs.unlinkSync as jest.Mock).mockImplementation(mockFs.unlinkSync);
  });

  const runScript = async () => {
    await jest.isolateModulesAsync(async () => {
      await import('../../scripts/startup-project.js');
    });
  };

  test('1. Should sanitize inputs and update global config files (package.json, package-lock.json, readme.md, env.ts, tools.metadata.ts)', async () => {
    mockAskQuestion
      .mockResolvedValueOnce('My Weather API') // Project
      .mockResolvedValueOnce('Weather Data')   // Domain
      .mockResolvedValueOnce('Get Forecast')   // Service
      .mockResolvedValueOnce('current_weather')// Tool
      .mockResolvedValueOnce('fetch');         // Client

    await runScript();

    // 1. Check package.json updates
    const pkg = JSON.parse(mockFs.virtualFileSystem[abs('package.json')]);
    expect(pkg.name).toBe('my-weather-api');
    expect(pkg.description).toBe('my-weather-api'); 

    // 2. Check package-lock.json updates
    const lock = JSON.parse(mockFs.virtualFileSystem[abs('package-lock.json')]);
    expect(lock.name).toBe('my-weather-api');

    // 3. Check Readme updates
    const readme = mockFs.virtualFileSystem[abs('readme.md')];
    expect(readme).toContain('# my-weather-api MCP Server');
    expect(readme).not.toContain('example-mcp-proj-name');
    
    // 4. Check env.ts updates (Full Content)
    const env = mockFs.virtualFileSystem[abs('src/env.ts')];
    // FIX: Match the escaped backslash in the expected string as well
    const expectedEnv = `import toolMetadata from "./tools.metadata.js";

const env = {
  SERVER_NAME: "my-weather-api",
  TOOLS_ENABLED: [
    process.env.CURRENT_WEATHER === "false" ? null : toolMetadata.current_weather.name,
  ].filter(element => element !== null),
  API: {
    Url: (() : string => {
      if (!process.env.API_URL) {
        throw new Error("API_URL environment variable is not defined");
      }

      return process.env.API_URL.replace(/\\/$/, "") ?? "";
    })(),
    headers: {
      Example: process.env.EXAMPLE_HEADER || "",
    }
  }
}

export default env;`;
    expect(env).toBe(expectedEnv);

    // 5. Check metadata file updates (Full Content)
    const meta = mockFs.virtualFileSystem[abs('src/tools.metadata.ts')];
    const expectedMeta = `const toolMetadata = {
  current_weather: {
    name: "current_weather",
    description: \`Example tool.\`,
  },
}

export default toolMetadata;`;
    expect(meta).toBe(expectedMeta);
  });

  test('2. Should rename Domain directory and files', async () => {
    mockAskQuestion
      .mockResolvedValueOnce('proj')
      .mockResolvedValueOnce('User Auth') // Domain -> user-auth
      .mockResolvedValueOnce('login')
      .mockResolvedValueOnce('login_tool')
      .mockResolvedValueOnce('doLogin');

    await runScript();

    const oldDir = abs('src/domain/domain-name');
    const newDir = abs('src/domain/user-auth');
    
    // Validate directory rename was called
    expect(mockFs.trackedRenames[oldDir]).toBe(newDir);

    // Validate DTO file rename (happens inside new directory)
    const oldDto = path.join(newDir, 'dtos', 'domain.dto.ts');
    const newDto = path.join(newDir, 'dtos', 'login.dto.ts');
    expect(mockFs.trackedRenames[oldDto]).toBe(newDto);
    
    // Verify file actually exists in VFS at new path
    const dtoContent = mockFs.virtualFileSystem[newDto];
    expect(dtoContent).toBeDefined();

    // Verify DTO content replacement (Full Content)
    const expectedDtoContent = `export type LoginResponseDto = {
  results: any[];
}

export interface LoginRequestDto {
  exampleParam: string;
}`;
    expect(dtoContent).toBe(expectedDtoContent);
  });

  test('3. Should update Service and Client code content correctly', async () => {
    mockAskQuestion
      .mockResolvedValueOnce('proj')
      .mockResolvedValueOnce('Order System') // Domain -> order-system
      .mockResolvedValueOnce('create order') // Service -> createOrder
      .mockResolvedValueOnce('create_order')
      .mockResolvedValueOnce('post order');  // Client -> postOrder

    await runScript();

    const domainDir = abs('src/domain/order-system');
    const clientsDir = path.join(domainDir, 'clients');
    const servicesDir = path.join(domainDir, 'services');

    // 1. Verify File Renames
    const oldServicePath = path.join(servicesDir, 'domain.service.ts');
    const newServicePath = path.join(servicesDir, 'order-system.service.ts');
    expect(mockFs.trackedRenames[oldServicePath]).toBe(newServicePath);

    const oldDbClientPath = path.join(clientsDir, 'domain.db.client.ts');
    const newDbClientPath = path.join(clientsDir, 'order-system.db.client.ts');
    expect(mockFs.trackedRenames[oldDbClientPath]).toBe(newDbClientPath);

    const oldHttpClientPath = path.join(clientsDir, 'domain.http.client.ts');
    const newHttpClientPath = path.join(clientsDir, 'order-system.http.client.ts');
    expect(mockFs.trackedRenames[oldHttpClientPath]).toBe(newHttpClientPath);
    
    // 2. Verify Service Content Updates (Full Content)
    const serviceContent = mockFs.virtualFileSystem[newServicePath];
    const expectedService = `import { OrderSystemHttpClient } from "../clients/order-system.http.client.js";
import { CreateOrderRequestDto, CreateOrderResponseDto } from "../dtos/createOrder.dto.js";

export class OrderSystemService {
  constructor(private readonly httpClient: OrderSystemHttpClient) { }

  async createOrder(dto: CreateOrderRequestDto): Promise<CreateOrderResponseDto | null> {
    const data = await this.httpClient.postOrder(dto);
    return data;
  }
}

export default new OrderSystemService(new OrderSystemHttpClient());`;
    expect(serviceContent).toBe(expectedService);

    // 3. Verify HTTP Client Content Updates (Full Content)
    const httpClientContent = mockFs.virtualFileSystem[newHttpClientPath];
    const expectedHttp = `import HttpClient from "../../../api/client.js";
import env from "../../../env.js";
import { CreateOrderRequestDto, CreateOrderResponseDto } from "../dtos/createOrder.dto.js";
import { getHeaders } from "../utils/api.js";

export class OrderSystemHttpClient {
  private readonly httpClient: HttpClient
  constructor() {
    this.httpClient = new HttpClient(env.API.Url, getHeaders())
  }

  async postOrder(dto: CreateOrderRequestDto): Promise<CreateOrderResponseDto | null> {
    try {
      const data = await this.httpClient.post<CreateOrderResponseDto>("/", { ...dto });
      return data;
    } catch (e) {
      console.error(\`Failed to execute query: \`, e);
      return null;
    }
  }
}`;
    expect(httpClientContent).toBe(expectedHttp);

    // 4. Verify DB Client Content Updates (Full Content)
    const dbClientContent = mockFs.virtualFileSystem[newDbClientPath];
    const expectedDb = `import { CreateOrderRequestDto, CreateOrderResponseDto } from "../dtos/createOrder.dto.js";

export class OrderSystemDbClient  {
  async postOrder(_: CreateOrderRequestDto): Promise<CreateOrderResponseDto | null> {
    return null;
  }
}`;
    expect(dbClientContent).toBe(expectedDb);
  });

  test('4. Should update MCP Tools Registry (tools.ts)', async () => {
    mockAskQuestion
      .mockResolvedValueOnce('proj')
      .mockResolvedValueOnce('Billing')
      .mockResolvedValueOnce('Process Payment') // Service -> processPayment (camelCase)
      .mockResolvedValueOnce('pay_bill')
      .mockResolvedValueOnce('req');

    await runScript();

    const toolsPath = abs('src/mcp/tools.ts');
    const content = mockFs.virtualFileSystem[toolsPath];

    // Check Full Content
    const expectedTools = `import z from "zod";
import { ToolDefinition } from "./utils/dtos.js";
import toolMetadata from "../tools.metadata.js";
import buildTool from "./utils/newTool.js";
import BillingService from "../domain/billing/services/billing.service.js";

const tools: Record<string, ToolDefinition> = {
  [toolMetadata.pay_bill.name]: {
    name: toolMetadata.pay_bill.name,
    description: toolMetadata.pay_bill.description,
    inputSchema: {
      exampleParam: z.string().describe(\`Example Tool param description\`),
    },
    callback: buildTool(BillingService.processPayment.bind(BillingService)),
  },
}

export default tools;`;
    
    expect(content).toBe(expectedTools);
  });

  test('5. Should self-destruct after execution', async () => {
    mockAskQuestion.mockResolvedValue('test');
    await runScript();

    // Check file deletion
    const scriptPath = abs(path.join('scripts', 'startup-project.ts'));
    expect(mockFs.trackedDeletions).toContain(scriptPath);

    // Check package.json script removal
    const pkg = JSON.parse(mockFs.virtualFileSystem[abs('package.json')]);
    expect(pkg.scripts['startup-project']).toBeUndefined();
    expect(pkg.scripts['start']).toBeDefined(); 
  });
});