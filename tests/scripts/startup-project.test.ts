import * as fs from 'fs';
import * as path from 'path';

// We mock utils to control user input and prevent actual console logging
jest.mock('../../scripts/utils', () => ({
  askQuestion: jest.fn(),
  rl: { close: jest.fn() },
  logBanner: jest.fn(),
  logEndBanner: jest.fn(),
  // We use the actual implementation for the case converters to ensure 
  // the script logic uses them correctly
  toKebabCase: jest.requireActual('../../scripts/utils').toKebabCase,
  toCamelCase: jest.requireActual('../../scripts/utils').toCamelCase,
  toPascalCase: jest.requireActual('../../scripts/utils').toPascalCase,
  toSnakeCase: jest.requireActual('../../scripts/utils').toSnakeCase,
}));

import { askQuestion } from '../../scripts/utils.js';

// Mock fs to prevent actual file system changes
jest.mock('fs');

describe('Startup Project Script', () => {
  const mockAskQuestion = askQuestion as jest.Mock;
  
  // Storage for file writes so we can inspect them
  let writtenFiles: Record<string, string> = {};
  let renamedFiles: Record<string, string> = {};
  let deletedFiles: string[] = [];

  // Mock Data mimicking the provided template files
  const mockFileSystem: Record<string, string> = {
    [path.resolve('package.json')]: JSON.stringify({
      name: "example-mcp-proj-name",
      description: "example-mcp-proj-name",
      scripts: { "startup-project": "ts-node scripts/startup-project.ts" }
    }),
    [path.resolve('package-lock.json')]: JSON.stringify({ name: "example-mcp-proj-name" }),
    [path.resolve('readme.md')]: "# example-mcp-proj-name MCP Server",
    [path.resolve('src/env.ts')]: 'SERVER_NAME: "example-mcp-proj-name", process.env.EXAMPLE_TOOL === "false" ? null : toolMetadata.example_tool.name',
    [path.resolve('src/tools.metadata.ts')]: 'example_tool: { name: "example_tool" }',
    // Domain Files
    [path.resolve('src/domain/domain-name/dtos/domain.dto.ts')]: 'export interface DomainExampleRequestDto {}',
    [path.resolve('src/domain/domain-name/clients/domain.db.client.ts')]: 'class DomainDbClient { async example() {} }',
    [path.resolve('src/domain/domain-name/clients/domain.http.client.ts')]: 'class DomainHttpClient { async example() {} }',
    [path.resolve('src/domain/domain-name/services/domain.service.ts')]: 'class DomainService { async example() {} new DomainService() }',
    [path.resolve('src/mcp/tools.ts')]: 'import DomainService from "../domain/domain-name/services/domain.service.js"; DomainService.example.bind(DomainService) toolMetadata.example_tool.name',
    [path.join(process.cwd(), 'scripts', 'startup-project.ts')]: 'script content'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    writtenFiles = {};
    renamedFiles = {};
    deletedFiles = [];

    // Setup FS Mocks
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      const resolved = path.resolve(filePath);
      return mockFileSystem[resolved] || '';
    });

    (fs.writeFileSync as jest.Mock).mockImplementation((filePath: string, content: string) => {
      writtenFiles[path.resolve(filePath)] = content;
    });

    (fs.renameSync as jest.Mock).mockImplementation((oldPath: string, newPath: string) => {
      renamedFiles[path.resolve(oldPath)] = path.resolve(newPath);
    });

    (fs.unlinkSync as jest.Mock).mockImplementation((filePath: string) => {
      deletedFiles.push(path.resolve(filePath));
    });
  });

  const runScript = async () => {
    // We isolate modules so we can re-import (and re-run) the script for every test
    await jest.isolateModulesAsync(async () => {
      await import('../../scripts/startup-project.js');
    });
  };

  test('It should sanitize inputs and rename project files (kebab-case)', async () => {
    // 1. Setup Input with spaces and mixed case
    mockAskQuestion
      .mockResolvedValueOnce('My Cool Project')   // 1. Project Name
      .mockResolvedValueOnce('Weather Data')      // 2. Domain Name
      .mockResolvedValueOnce('Get Forecast')      // 3. Service Method
      .mockResolvedValueOnce('Current Weather')   // 4. Tool Name
      .mockResolvedValueOnce('Fetch From API');   // 5. Client Method

    // 2. Run Script
    await runScript();

    // 3. Assertions on package.json (Project Name sanitization)
    const packageJsonPath = path.resolve('package.json');
    expect(writtenFiles[packageJsonPath]).toBeDefined();
    const pkg = JSON.parse(writtenFiles[packageJsonPath]);
    
    // Should be kebab-case "my-cool-project"
    expect(pkg.name).toBe('my-cool-project');
    expect(pkg.description).toBe('my-cool-project');
    // Should remove startup script
    expect(pkg.scripts['startup-project']).toBeUndefined();
  });

  test('It should rename directories and files based on domain input', async () => {
    mockAskQuestion
      .mockResolvedValueOnce('proj')
      .mockResolvedValueOnce('User Auth') // Domain: "User Auth" -> "user-auth"
      .mockResolvedValueOnce('login')
      .mockResolvedValueOnce('user_login')
      .mockResolvedValueOnce('doLogin');

    await runScript();

    // Directory Rename
    const oldDir = path.resolve('src/domain/domain-name');
    const newDir = path.resolve('src/domain/user-auth');
    expect(renamedFiles[oldDir]).toBe(newDir);

    // File Renames (checking specific paths)
    // DTO
    expect(renamedFiles[path.resolve(newDir, 'dtos/domain.dto.ts')])
      .toBe(path.resolve(newDir, 'dtos/login.dto.ts')); // camelCase method name used for file

    // Service
    expect(renamedFiles[path.resolve(newDir, 'services/domain.service.ts')])
      .toBe(path.resolve(newDir, 'services/user-auth.service.ts')); // kebab-case domain used for file
  });

  test('It should sanitize class names and update content correctly (PascalCase)', async () => {
    mockAskQuestion
      .mockResolvedValueOnce('proj')
      .mockResolvedValueOnce('credit card') // Domain
      .mockResolvedValueOnce('process payment') // Service Method
      .mockResolvedValueOnce('pay')
      .mockResolvedValueOnce('charge');

    await runScript();

    // Check Service File Content
    // We look for where the file was written. Note: The script writes to the *new* path.
    // In our mock, fs.renameSync runs first, then replaceInFile writes to the NEW path.
    
    // We simulate the path resolution for the service file
    const servicePath = path.resolve('src/domain/credit-card/services/credit-card.service.ts');
    const serviceContent = writtenFiles[servicePath];

    expect(serviceContent).toBeDefined();

    // "credit card" -> CreditCardService (PascalCase)
    expect(serviceContent).toContain('class CreditCardService');
    
    // "process payment" -> processPayment (camelCase)
    expect(serviceContent).toContain('async processPayment(');
    
    // "credit card" -> CreditCardHttpClient (PascalCase)
    expect(serviceContent).toContain('CreditCardHttpClient');

    // DTO names: "process payment" -> ProcessPaymentRequestDto
    expect(serviceContent).toContain('ProcessPaymentRequestDto');
  });

  test('It should update Environment and Tools Metadata (Snake Case)', async () => {
    mockAskQuestion
      .mockResolvedValueOnce('proj')
      .mockResolvedValueOnce('dom')
      .mockResolvedValueOnce('met')
      .mockResolvedValueOnce('Get User Info') // Tool Name input with spaces
      .mockResolvedValueOnce('cli');

    await runScript();

    // Check src/env.ts
    const envPath = path.resolve('src/env.ts');
    const envContent = writtenFiles[envPath];
    // "Get User Info" -> GET_USER_INFO (Upper Snake Case for Env Var)
    expect(envContent).toContain('process.env.GET_USER_INFO');
    // "Get User Info" -> get_user_info (Lower Snake Case for metadata property)
    expect(envContent).toContain('toolMetadata.get_user_info.name');

    // Check src/tools.metadata.ts
    const metaPath = path.resolve('src/tools.metadata.ts');
    const metaContent = writtenFiles[metaPath];
    // Object key should be snake_case
    expect(metaContent).toContain('get_user_info:');
    expect(metaContent).toContain('name: "get_user_info"');
  });

  test('It should update tool registration imports in src/mcp/tools.ts', async () => {
     mockAskQuestion
      .mockResolvedValueOnce('proj')
      .mockResolvedValueOnce('billing system') // Domain
      .mockResolvedValueOnce('calculate tax') // Service Method
      .mockResolvedValueOnce('tax_calc')
      .mockResolvedValueOnce('req');

    await runScript();

    const toolsPath = path.resolve('src/mcp/tools.ts');
    const toolsContent = writtenFiles[toolsPath];

    // Check Import Path update: domain-name -> billing-system
    // Check Service File update: domain.service.js -> billing-system.service.js
    expect(toolsContent).toContain('billing-system/services/billing-system.service.js');

    // Check Class usage: BillingSystemService
    expect(toolsContent).toContain('import BillingSystemService');
    expect(toolsContent).toContain('BillingSystemService.calculateTax');
    expect(toolsContent).toContain('.bind(BillingSystemService)');
  });

  test('It should delete itself after execution', async () => {
    mockAskQuestion
      .mockResolvedValue('test'); // Fill all with 'test'

    await runScript();

    const scriptPath = path.join(process.cwd(), 'scripts', 'startup-project.ts');
    expect(deletedFiles).toContain(scriptPath);
  });
});