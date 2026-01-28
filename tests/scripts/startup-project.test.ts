import * as fs from 'fs';
import * as path from 'path';

// 1. Mock utils
jest.mock('../../scripts/utils', () => ({
  askQuestion: jest.fn(),
  execute: jest.requireActual('../../scripts/utils').execute,
  getReadLineInterface: jest.fn(()=> ({ close: jest.fn() })) ,
  logBanner: jest.fn(),
  logEndBanner: jest.fn(),
  toKebabCase: jest.requireActual('../../scripts/utils').toKebabCase,
  toCamelCase: jest.requireActual('../../scripts/utils').toCamelCase,
  toPascalCase: jest.requireActual('../../scripts/utils').toPascalCase,
  toSnakeCase: jest.requireActual('../../scripts/utils').toSnakeCase,
}));

import { askQuestion } from '../../scripts/utils.js';

// 2. Mock fs
jest.mock('fs');

describe('Startup Project Script (Integration Test)', () => {
  const mockAskQuestion = askQuestion as jest.Mock;
  
  // Virtual File System State
  let virtualFileSystem: Record<string, string> = {};
  let trackedRenames: Record<string, string> = {};
  let trackedDeletions: string[] = [];

  // Helper to normalize paths
  const abs = (p: string) => path.resolve(p);

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
    [abs('src/env.ts')]: 'SERVER_NAME: "example-mcp-proj-name", process.env.EXAMPLE_TOOL === "false" ? null : toolMetadata.example_tool.name',
    [abs('src/tools.metadata.ts')]: 'example_tool: { name: "example_tool" }',
    
    // Directories (Explicit entries needed for recursive logic)
    [abs('src/domain/domain-name')]: 'DIRECTORY',
    [abs('src/domain/domain-name/dtos')]: 'DIRECTORY',
    [abs('src/domain/domain-name/clients')]: 'DIRECTORY',
    [abs('src/domain/domain-name/services')]: 'DIRECTORY',

    // Domain Files
    [abs('src/domain/domain-name/dtos/domain.dto.ts')]: 
      'export interface DomainExampleRequestDto {} export interface DomainExampleResponseDto {}',

    // UPDATED: Includes Promise<DomainExampleResponseDto>
    [abs('src/domain/domain-name/clients/domain.db.client.ts')]: 
      'import { DomainExampleRequestDto, DomainExampleResponseDto } from "../dtos/domain.dto.js";\n' +
      'export class DomainDbClient { async example(_: DomainExampleRequestDto): Promise<DomainExampleResponseDto | null> { return null; } }',

    // UPDATED: Includes Promise<DomainExampleResponseDto>
    [abs('src/domain/domain-name/clients/domain.http.client.ts')]: 
      'import { DomainExampleRequestDto, DomainExampleResponseDto } from "../dtos/domain.dto.js";\n' +
      'export class DomainHttpClient { async example(dto: DomainExampleRequestDto): Promise<DomainExampleResponseDto | null> { return null; } }',

    // UPDATED: Includes Promise<DomainExampleResponseDto>
    [abs('src/domain/domain-name/services/domain.service.ts')]: 
      'import { DomainHttpClient } from "../clients/domain.http.client.js";\n' +
      'import { DomainExampleRequestDto, DomainExampleResponseDto } from "../dtos/domain.dto.js";\n' +
      'export class DomainService { constructor(private readonly httpClient: DomainHttpClient) {} async example(dto: DomainExampleRequestDto): Promise<DomainExampleResponseDto | null> { return this.httpClient.example(dto); } } new DomainService(new DomainHttpClient())',
    
    // MCP Tools
    [abs('src/mcp/tools.ts')]: 
      'import DomainService from "../domain/domain-name/services/domain.service.js";\n' +
      'callback: buildTool(DomainService.example.bind(DomainService)),\n' +
      '[toolMetadata.example_tool.name]',
      
    // Script
    [abs(path.join('scripts', 'startup-project.ts'))]: 'console.log("running");'
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset VFS to clean state for every test
    virtualFileSystem = getBaseFileSystem();
    trackedRenames = {};
    trackedDeletions = [];

    // --- FS Implementation ---

    (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
      return !!virtualFileSystem[abs(filePath)];
    });

    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      const content = virtualFileSystem[abs(filePath)];
      if (content === undefined) throw new Error(`FNOENT: ${filePath}`);
      return content;
    });

    (fs.writeFileSync as jest.Mock).mockImplementation((filePath: string, content: string) => {
      virtualFileSystem[abs(filePath)] = content;
    });

    (fs.renameSync as jest.Mock).mockImplementation((oldPath: string, newPath: string) => {
      const oldAbs = abs(oldPath);
      const newAbs = abs(newPath);
      
      trackedRenames[oldAbs] = newAbs;

      // Recursive Move in VFS
      // We iterate all keys to find files nested under the renamed directory
      const keys = Object.keys(virtualFileSystem);
      for (const key of keys) {
        if (key === oldAbs) {
          // Rename the directory/file itself
          virtualFileSystem[newAbs] = virtualFileSystem[oldAbs];
          delete virtualFileSystem[oldAbs];
        } else if (key.startsWith(oldAbs + path.sep)) {
          // Rename nested file: /old/nested/file -> /new/nested/file
          const suffix = key.slice(oldAbs.length);
          const newKey = newAbs + suffix;
          virtualFileSystem[newKey] = virtualFileSystem[key];
          delete virtualFileSystem[key];
        }
      }
    });

    (fs.unlinkSync as jest.Mock).mockImplementation((filePath: string) => {
      const p = abs(filePath);
      delete virtualFileSystem[p];
      trackedDeletions.push(p);
    });
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
    const pkg = JSON.parse(virtualFileSystem[abs('package.json')]);
    expect(pkg.name).toBe('my-weather-api');
    expect(pkg.description).toBe('my-weather-api'); // MISSING IN ORIGINAL TEST

    // 2. Check package-lock.json updates (MISSING IN ORIGINAL TEST)
    const lock = JSON.parse(virtualFileSystem[abs('package-lock.json')]);
    expect(lock.name).toBe('my-weather-api');

    // 3. Check Readme updates (MISSING IN ORIGINAL TEST)
    const readme = virtualFileSystem[abs('readme.md')];
    expect(readme).toContain('# my-weather-api MCP Server');
    expect(readme).not.toContain('example-mcp-proj-name');
    
    // 4. Check env.ts updates (Existing)
    const env = virtualFileSystem[abs('src/env.ts')];
    expect(env).toContain('SERVER_NAME: "my-weather-api"');
    expect(env).toContain('process.env.CURRENT_WEATHER');

    // 5. Check metadata file updates (Existing)
    const meta = virtualFileSystem[abs('src/tools.metadata.ts')];
    expect(meta).toContain('current_weather: {');
    expect(meta).toContain('name: "current_weather"');
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
    expect(trackedRenames[oldDir]).toBe(newDir);

    // Validate DTO file rename (happens inside new directory)
    // Script Logic: domain.dto.ts -> [serviceMethod].dto.ts (login.dto.ts)
    const oldDto = path.join(newDir, 'dtos', 'domain.dto.ts');
    const newDto = path.join(newDir, 'dtos', 'login.dto.ts');
    expect(trackedRenames[oldDto]).toBe(newDto);
    
    // Verify file actually exists in VFS at new path
    const dtoContent = virtualFileSystem[newDto];
    expect(dtoContent).toBeDefined();

    // NEW: Verify DTO content replacement
    expect(dtoContent).toContain('export interface LoginRequestDto');
    expect(dtoContent).toContain('export interface LoginResponseDto');
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

    // 1. Verify File Renames (Explicit Checks)
    // The script first renames the domain directory, so subsequent file renames 
    // happen relative to the new domain directory path.
    const oldServicePath = path.join(servicesDir, 'domain.service.ts');
    const newServicePath = path.join(servicesDir, 'order-system.service.ts');
    expect(trackedRenames[oldServicePath]).toBe(newServicePath);

    const oldDbClientPath = path.join(clientsDir, 'domain.db.client.ts');
    const newDbClientPath = path.join(clientsDir, 'order-system.db.client.ts');
    expect(trackedRenames[oldDbClientPath]).toBe(newDbClientPath);

    const oldHttpClientPath = path.join(clientsDir, 'domain.http.client.ts');
    const newHttpClientPath = path.join(clientsDir, 'order-system.http.client.ts');
    expect(trackedRenames[oldHttpClientPath]).toBe(newHttpClientPath);
    
    // 2. Verify Service Content Updates
    const serviceContent = virtualFileSystem[newServicePath];
    expect(serviceContent).toBeDefined();
    expect(serviceContent).toContain('class OrderSystemService');
    expect(serviceContent).toContain('async createOrder(');
    expect(serviceContent).toContain('OrderSystemHttpClient');
    expect(serviceContent).toContain('this.httpClient.postOrder(');
    expect(serviceContent).toContain('CreateOrderRequestDto');

    // 3. Verify HTTP Client Content Updates
    const httpClientContent = virtualFileSystem[newHttpClientPath];
    expect(httpClientContent).toBeDefined();
    expect(httpClientContent).toContain('class OrderSystemHttpClient');
    expect(httpClientContent).toContain('async postOrder(');
    expect(httpClientContent).toContain('"../dtos/createOrder.dto.js"');
    expect(httpClientContent).toContain('CreateOrderResponseDto');

    // 4. Verify DB Client Content Updates
    const dbClientContent = virtualFileSystem[newDbClientPath];
    expect(dbClientContent).toBeDefined();
    expect(dbClientContent).toContain('class OrderSystemDbClient');
    expect(dbClientContent).toContain('async postOrder(');
    expect(dbClientContent).toContain('"../dtos/createOrder.dto.js"');
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
    const content = virtualFileSystem[toolsPath];

    // Check Import path replacement
    expect(content).toContain('from "../domain/billing/services/billing.service.js"');
    
    // Check Class usage
    expect(content).toContain('import BillingService');
    
    // Check Method binding (camelCase)
    expect(content).toContain('BillingService.processPayment'); 
    expect(content).toContain('.bind(BillingService)');
    
    // Check Metadata key
    expect(content).toContain('[toolMetadata.pay_bill.name]');
  });

  test('5. Should self-destruct after execution', async () => {
    mockAskQuestion.mockResolvedValue('test');
    await runScript();

    // Check file deletion
    const scriptPath = abs(path.join('scripts', 'startup-project.ts'));
    expect(trackedDeletions).toContain(scriptPath);

    // NEW: Check package.json script removal
    const pkg = JSON.parse(virtualFileSystem[abs('package.json')]);
    expect(pkg.scripts['startup-project']).toBeUndefined();
    expect(pkg.scripts['start']).toBeDefined(); // Ensure we didn't delete other scripts
  });
});