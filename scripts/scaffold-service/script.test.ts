import * as fs from 'fs';
import * as path from 'path';
import { MockFileSystem, abs } from '../tests/utils/file-system.js';
import * as mockUtils from '../tests/mocks/utils.js';

jest.mock('../utils.js', () => mockUtils);
jest.mock('fs');

describe('Scaffold Service Script', () => {
  let mockFs: MockFileSystem;

  // Helpers from our mock file
  const { __getExecutionPromise, __resetExecutionPromise, askQuestion } = mockUtils as any;

  // Paths for a test domain
  const domainDir = abs('src/domain/order-system');
  const servicesDir = path.join(domainDir, 'services');
  const clientsDir = path.join(domainDir, 'clients');
  const dtosDir = path.join(domainDir, 'dtos');

  // Helper to init FS with a valid domain structure so the script can find it
  const initFileSystem = (additionalFiles: Record<string, string> = {}) => {
    mockFs = new MockFileSystem({
      [abs('src/domain')]: 'DIRECTORY',
      [domainDir]: 'DIRECTORY',
      [servicesDir]: 'DIRECTORY',
      [clientsDir]: 'DIRECTORY',
      [dtosDir]: 'DIRECTORY',
      // We need at least one existing service file for getDomainsServicesWithDomainMap to detect the domain
      [path.join(servicesDir, 'placeholder.service.ts')]: 'export class PlaceholderService {}',
      ...additionalFiles
    });

    // Wire up fs mocks
    (fs.existsSync as jest.Mock).mockImplementation(mockFs.existsSync);
    (fs.writeFileSync as jest.Mock).mockImplementation(mockFs.writeFileSync);
    (fs.mkdirSync as jest.Mock).mockImplementation(mockFs.mkdirSync);
    (fs.readdirSync as jest.Mock).mockImplementation(mockFs.readdirSync);
    (fs.readFileSync as jest.Mock).mockImplementation(mockFs.readFileSync);
    (fs.statSync as jest.Mock).mockImplementation(mockFs.statSync);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    __resetExecutionPromise();
  });

  const runScript = async () => {
    await jest.isolateModulesAsync(async () => {
      await import('./script.js');
    });
    const promise = __getExecutionPromise();
    if (promise) await promise;
  };

  test('1. Should generate Service with Method, DTO, and NEW Clients (Full Content Check)', async () => {
    initFileSystem({
        [abs('src/api/client.ts')]: 'export default class HttpClient {}',
        [abs('src/env.ts')]: 'export default {}'
    });

    askQuestion
      .mockResolvedValueOnce('1')             // 1. Select Domain (order-system)
      .mockResolvedValueOnce('process-order') // 2. Service Name
      .mockResolvedValueOnce('execute')       // 3. Method Name
      .mockResolvedValueOnce('2')             // 4. DB Client -> Create New
      .mockResolvedValueOnce('order-db')      //    New DB Client Name
      .mockResolvedValueOnce('2')             // 5. HTTP Client -> Create New
      .mockResolvedValueOnce('payment-api');  //    New HTTP Client Name

    await runScript();

    // 1. Verify Service File
    const servicePath = path.join(servicesDir, 'process-order.service.ts');
    expect(mockFs.virtualFileSystem[servicePath]).toBeDefined();
    
    const serviceContent = mockFs.virtualFileSystem[servicePath];
    // NOTE: Added newline before the closing brace of the class to match script template
    const expectedService = `
import { OrderDbDbClient } from "../clients/order-db.db.client.js";
import { PaymentApiHttpClient } from "../clients/payment-api.http.client.js";
import { ExecuteRequestDto, ExecuteResponseDto } from "../dtos/execute.dto.js";

export class ProcessOrderService {
  constructor(private readonly dbClient: OrderDbDbClient, private readonly httpClient: PaymentApiHttpClient) {}

  async execute(dto: ExecuteRequestDto): Promise<ExecuteResponseDto | null> {
    // TODO: Implement logic
    return null;
  }

}

export default new ProcessOrderService(new OrderDbDbClient(), new PaymentApiHttpClient());
`.trim();
    expect(serviceContent.trim()).toBe(expectedService);

    // 2. Verify DTO File
    const dtoPath = path.join(dtosDir, 'execute.dto.ts');
    expect(mockFs.virtualFileSystem[dtoPath]).toBeDefined();
    expect(mockFs.virtualFileSystem[dtoPath]).toContain('export interface ExecuteRequestDto');
    expect(mockFs.virtualFileSystem[dtoPath]).toContain('export interface ExecuteResponseDto');

    // 3. Verify New DB Client
    const dbClientPath = path.join(clientsDir, 'order-db.db.client.ts');
    expect(mockFs.virtualFileSystem[dbClientPath]).toBeDefined();
    expect(mockFs.virtualFileSystem[dbClientPath]).toContain('export class OrderDbDbClient');

    // 4. Verify New HTTP Client
    const httpClientPath = path.join(clientsDir, 'payment-api.http.client.ts');
    expect(mockFs.virtualFileSystem[httpClientPath]).toBeDefined();
    expect(mockFs.virtualFileSystem[httpClientPath]).toContain('export class PaymentApiHttpClient');
  });

  test('2. Should generate Service using EXISTING Clients', async () => {
    // Pre-populate existing clients
    initFileSystem({
        [path.join(clientsDir, 'existing.db.client.ts')]: 'export class ExistingDbClient {}',
        [path.join(clientsDir, 'existing.http.client.ts')]: 'export class ExistingHttpClient {}'
    });

    askQuestion
      .mockResolvedValueOnce('1')             // 1. Select Domain
      .mockResolvedValueOnce('audit-log')     // 2. Service Name
      .mockResolvedValueOnce('')              // 3. Method Name (Empty -> No DTOs)
      .mockResolvedValueOnce('3')             // 4. DB Client -> Use Existing (index 3 corresponds to first existing file)
      .mockResolvedValueOnce('3');            // 5. HTTP Client -> Use Existing

    await runScript();

    const servicePath = path.join(servicesDir, 'audit-log.service.ts');
    expect(mockFs.virtualFileSystem[servicePath]).toBeDefined();

    const serviceContent = mockFs.virtualFileSystem[servicePath];

    // Verify Imports point to existing files
    expect(serviceContent).toContain('import { ExistingDbClient } from "../clients/existing.db.client.js";');
    expect(serviceContent).toContain('import { ExistingHttpClient } from "../clients/existing.http.client.js";');
    
    // Verify Constructor
    expect(serviceContent).toContain('constructor(private readonly dbClient: ExistingDbClient, private readonly httpClient: ExistingHttpClient)');
    
    // Verify No DTO import since method name was empty
    // NOTE: Changed assertion to specifically look for DTO files, not just any named import
    expect(serviceContent).not.toContain('.dto.js');
  });

  test('3. Should generate Service with NO clients and NO method', async () => {
    initFileSystem();

    askQuestion
      .mockResolvedValueOnce('1')             // 1. Select Domain
      .mockResolvedValueOnce('simple-task')   // 2. Service Name
      .mockResolvedValueOnce('')              // 3. Method Name (Empty)
      .mockResolvedValueOnce('1')             // 4. DB Client -> None
      .mockResolvedValueOnce('1');            // 5. HTTP Client -> None

    await runScript();

    const servicePath = path.join(servicesDir, 'simple-task.service.ts');
    expect(mockFs.virtualFileSystem[servicePath]).toBeDefined();

    const serviceContent = mockFs.virtualFileSystem[servicePath];
    
    // Expect clean class with empty constructor
    const expected = `
export class SimpleTaskService {
  constructor() {}

}

export default new SimpleTaskService();
`.trim();
    
    expect(serviceContent.trim()).toBe(expected);
  });

  test('4. Should exit gracefully if no domains are found', async () => {
    // Empty FS (no domains)
    mockFs = new MockFileSystem({
        [abs('src/domain')]: 'DIRECTORY'
    });
    // Wire mocks again since we re-instantiated
    (fs.existsSync as jest.Mock).mockImplementation(mockFs.existsSync);
    (fs.readdirSync as jest.Mock).mockImplementation(mockFs.readdirSync);
    (fs.statSync as jest.Mock).mockImplementation(mockFs.statSync);

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await runScript();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FATAL ERROR]'),
        expect.objectContaining({ message: expect.stringContaining('No domains found') })
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test('5. Should handle invalid domain selection', async () => {
    initFileSystem();

    askQuestion
      .mockResolvedValueOnce('99'); // Invalid Index

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await runScript();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FATAL ERROR]'),
        expect.objectContaining({ message: expect.stringContaining('Invalid selection') })
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});