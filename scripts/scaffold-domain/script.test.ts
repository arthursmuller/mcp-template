import * as fs from 'fs';
import * as path from 'path';
import { MockFileSystem, abs } from '../tests/utils/file-system.js';
import * as mockUtils from '../tests/mocks/utils.js';

jest.mock('../utils.js', () => mockUtils);
jest.mock('fs');

describe('Scaffold Domain Script', () => {
  let mockFs: MockFileSystem;

  // Helpers from our mock file
  const { __getExecutionPromise, __resetExecutionPromise, askQuestion } = mockUtils as any;

  // Common paths
  const domainRoot = abs('src/domain');

  beforeEach(() => {
    jest.clearAllMocks();
    __resetExecutionPromise();
    
    // Initialize VFS
    mockFs = new MockFileSystem({
      [domainRoot]: 'DIRECTORY',
      [abs('src/api/client.ts')]: 'export default class HttpClient {}',
      [abs('src/env.ts')]: 'export default {}'
    });

    // Wire up fs mocks
    (fs.existsSync as jest.Mock).mockImplementation(mockFs.existsSync);
    (fs.writeFileSync as jest.Mock).mockImplementation(mockFs.writeFileSync);
    (fs.mkdirSync as jest.Mock).mockImplementation(mockFs.mkdirSync);
    (fs.readdirSync as jest.Mock).mockImplementation(mockFs.readdirSync);
    (fs.readFileSync as jest.Mock).mockImplementation(mockFs.readFileSync);
    (fs.statSync as jest.Mock).mockImplementation(mockFs.statSync);
  });

  const runScript = async () => {
    await jest.isolateModulesAsync(async () => {
      await import('./script.js');
    });
    
    const promise = __getExecutionPromise();
    if (promise) await promise;
  };

  test('1. Should generate a full Domain (HTTP + DB) with custom method names', async () => {
    // Inputs: 
    // 1. Domain Name: analytics-data
    // 2. Add HTTP? y
    // 3. Add DB? y
    // 4. Client Method: fetch-stats
    // 5. Service Method: get-analytics
    askQuestion
      .mockResolvedValueOnce('analytics-data')
      .mockResolvedValueOnce('y')
      .mockResolvedValueOnce('y')
      .mockResolvedValueOnce('fetch-stats')
      .mockResolvedValueOnce('get-analytics');

    await runScript();

    const domainPath = path.join(domainRoot, 'analytics-data');
    const clientsDir = path.join(domainPath, 'clients');
    const servicesDir = path.join(domainPath, 'services');
    const dtosDir = path.join(domainPath, 'dtos');
    const utilsDir = path.join(domainPath, 'utils');

    // 1. Verify Directory Structure
    expect(mockFs.trackedDirs).toContain(domainPath);
    expect(mockFs.trackedDirs).toContain(clientsDir);
    expect(mockFs.trackedDirs).toContain(servicesDir);
    expect(mockFs.trackedDirs).toContain(dtosDir);
    expect(mockFs.trackedDirs).toContain(utilsDir); // Utils created for HTTP

    // 2. Verify DTO File
    const dtoPath = path.join(dtosDir, 'getAnalytics.dto.ts');
    expect(mockFs.virtualFileSystem[dtoPath]).toBeDefined();
    const dtoContent = mockFs.virtualFileSystem[dtoPath];
    expect(dtoContent).toContain('export interface GetAnalyticsRequestDto');
    expect(dtoContent).toContain('export interface GetAnalyticsResponseDto');

    // 3. Verify HTTP Client
    const httpClientPath = path.join(clientsDir, 'analytics-data.http.client.ts');
    const httpClientContent = mockFs.virtualFileSystem[httpClientPath];
    expect(httpClientContent).toContain('export class AnalyticsDataHttpClient');
    expect(httpClientContent).toContain('async fetchStats(dto: GetAnalyticsRequestDto)');
    expect(httpClientContent).toContain('import HttpClient from "../../../api/client.js";');

    // 4. Verify DB Client
    const dbClientPath = path.join(clientsDir, 'analytics-data.db.client.ts');
    const dbClientContent = mockFs.virtualFileSystem[dbClientPath];
    expect(dbClientContent).toContain('export class AnalyticsDataDbClient');
    expect(dbClientContent).toContain('async fetchStats(dto: GetAnalyticsRequestDto)'); // Uses same client method name input

    // 5. Verify Service
    const servicePath = path.join(servicesDir, 'analytics-data.service.ts');
    const serviceContent = mockFs.virtualFileSystem[servicePath];
    expect(serviceContent).toContain('export class AnalyticsDataService');
    expect(serviceContent).toContain('async getAnalytics(dto: GetAnalyticsRequestDto)');
    // Check constructor injection
    expect(serviceContent).toContain('private readonly httpClient: AnalyticsDataHttpClient');
    expect(serviceContent).toContain('private readonly dbClient: AnalyticsDataDbClient');
    // Check instantiation export
    expect(serviceContent).toContain('new AnalyticsDataService(new AnalyticsDataHttpClient(), new AnalyticsDataDbClient())');
  });

  test('2. Should generate Domain with HTTP Client ONLY', async () => {
    // Inputs: weather, y, n, fetch, get-weather
    askQuestion
      .mockResolvedValueOnce('weather')
      .mockResolvedValueOnce('y')
      .mockResolvedValueOnce('n')
      .mockResolvedValueOnce('fetch')
      .mockResolvedValueOnce('get-weather');

    await runScript();

    const domainPath = path.join(domainRoot, 'weather');
    
    // Check Files existence
    const httpClientPath = path.join(domainPath, 'clients', 'weather.http.client.ts');
    const dbClientPath = path.join(domainPath, 'clients', 'weather.db.client.ts');
    const apiUtilPath = path.join(domainPath, 'utils', 'api.ts');

    expect(mockFs.virtualFileSystem[httpClientPath]).toBeDefined();
    expect(mockFs.virtualFileSystem[apiUtilPath]).toBeDefined();
    expect(mockFs.virtualFileSystem[dbClientPath]).toBeUndefined();

    // Check Service Logic
    const servicePath = path.join(domainPath, 'services', 'weather.service.ts');
    const serviceContent = mockFs.virtualFileSystem[servicePath];
    
    expect(serviceContent).toContain('private readonly httpClient: WeatherHttpClient');
    expect(serviceContent).not.toContain('dbClient');
    expect(serviceContent).toContain('this.httpClient.fetch(dto)');
  });

  test('3. Should generate Domain with DB Client ONLY', async () => {
    // Inputs: users, n, y, query, get-users
    askQuestion
      .mockResolvedValueOnce('users')
      .mockResolvedValueOnce('n')
      .mockResolvedValueOnce('y')
      .mockResolvedValueOnce('query')
      .mockResolvedValueOnce('get-users');

    await runScript();

    const domainPath = path.join(domainRoot, 'users');
    
    // Check Files existence
    const httpClientPath = path.join(domainPath, 'clients', 'users.http.client.ts');
    const dbClientPath = path.join(domainPath, 'clients', 'users.db.client.ts');
    const apiUtilPath = path.join(domainPath, 'utils', 'api.ts');

    expect(mockFs.virtualFileSystem[dbClientPath]).toBeDefined();
    expect(mockFs.virtualFileSystem[httpClientPath]).toBeUndefined();
    expect(mockFs.virtualFileSystem[apiUtilPath]).toBeUndefined(); // Utils only needed for HTTP

    // Check Service Logic
    const servicePath = path.join(domainPath, 'services', 'users.service.ts');
    const serviceContent = mockFs.virtualFileSystem[servicePath];
    
    expect(serviceContent).toContain('private readonly dbClient: UsersDbClient');
    expect(serviceContent).not.toContain('httpClient');
    expect(serviceContent).toContain('this.dbClient.query(dto)');
  });

  test('4. Should generate Domain with NO clients', async () => {
    // Inputs: simple-logic, n, n, (client method skipped), do-calc
    askQuestion
      .mockResolvedValueOnce('simple-logic')
      .mockResolvedValueOnce('n')
      .mockResolvedValueOnce('n')
      .mockResolvedValueOnce('do-calc');

    await runScript();

    const domainPath = path.join(domainRoot, 'simple-logic');
    
    // Check Files existence
    const clientsDir = path.join(domainPath, 'clients');
    // The clients directory is created regardless, but should be empty of generated files
    // (Our MockFS just tracks the dir creation, verifying specific files don't exist)
    const httpClientPath = path.join(clientsDir, 'simple-logic.http.client.ts');
    const dbClientPath = path.join(clientsDir, 'simple-logic.db.client.ts');

    expect(mockFs.virtualFileSystem[httpClientPath]).toBeUndefined();
    expect(mockFs.virtualFileSystem[dbClientPath]).toBeUndefined();

    // Check Service Logic
    const servicePath = path.join(domainPath, 'services', 'simple-logic.service.ts');
    const serviceContent = mockFs.virtualFileSystem[servicePath];
    
    // Should have empty constructor and simple return null
    const expectedServiceBody = `
export class SimpleLogicService {
  constructor() {}

  async doCalc(dto: DoCalcRequestDto): Promise<DoCalcResponseDto | null> {
    // TODO: Implement business logic
    return null;
  }
}

export default new SimpleLogicService();
`.trim();
    
    // Removing imports from comparison for simplicity, checking body match
    expect(serviceContent).toContain(expectedServiceBody);
  });

  test('5. Should handle validation error: Empty Domain Name', async () => {
    // Setup default for subsequent calls to prevent TypeError
    askQuestion.mockResolvedValue('n'); 
    // First call is empty
    askQuestion.mockResolvedValueOnce('');

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await runScript();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FATAL ERROR]'),
        expect.objectContaining({ message: expect.stringContaining('Domain name is required') })
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test('6. Should handle validation error: Domain Already Exists', async () => {
    // Setup existing domain
    const existingPath = path.join(domainRoot, 'duplicate');
    mockFs.virtualFileSystem[existingPath] = 'DIRECTORY';
    
    (fs.existsSync as jest.Mock).mockImplementation(mockFs.existsSync);

    // Setup default for subsequent calls
    askQuestion.mockResolvedValue('n');
    // First call uses duplicate name
    askQuestion.mockResolvedValueOnce('duplicate'); 

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await runScript();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[FATAL ERROR]'),
      expect.objectContaining({ message: expect.stringContaining("Domain 'duplicate' already exists") })
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test('7. Should verify File Naming Conventions (Pascal, Kebab, Camel)', async () => {
    // Inputs with mixed casing to test normalization
    // Domain: "My Cool Domain" -> my-cool-domain
    // Service: "Do Something" -> doSomething
    askQuestion
      .mockResolvedValueOnce('My Cool Domain')
      .mockResolvedValueOnce('n')
      .mockResolvedValueOnce('n')
      .mockResolvedValueOnce('Do Something');

    await runScript();

    const domainDir = path.join(domainRoot, 'my-cool-domain');
    const serviceFile = path.join(domainDir, 'services', 'my-cool-domain.service.ts');
    const dtoFile = path.join(domainDir, 'dtos', 'doSomething.dto.ts');

    expect(mockFs.trackedDirs).toContain(domainDir);
    expect(mockFs.virtualFileSystem[serviceFile]).toBeDefined();
    expect(mockFs.virtualFileSystem[dtoFile]).toBeDefined();

    const serviceContent = mockFs.virtualFileSystem[serviceFile];
    expect(serviceContent).toContain('export class MyCoolDomainService'); // PascalCase
    expect(serviceContent).toContain('async doSomething(dto: DoSomethingRequestDto)'); // camelCase method, PascalCase DTO
  });

  test('8. Should use default method names when inputs are empty', async () => {
    // Inputs:
    // 1. Domain: default-names
    // 2. HTTP: y
    // 3. DB: y
    // 4. Client Method: "" (Empty) -> should become 'fetchData'
    // 5. Service Method: "" (Empty) -> should become 'getData'
    askQuestion
      .mockResolvedValueOnce('default-names')
      .mockResolvedValueOnce('y')
      .mockResolvedValueOnce('y')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('');

    await runScript();

    const domainPath = path.join(domainRoot, 'default-names');
    const servicePath = path.join(domainPath, 'services', 'default-names.service.ts');
    const httpClientPath = path.join(domainPath, 'clients', 'default-names.http.client.ts');
    const dbClientPath = path.join(domainPath, 'clients', 'default-names.db.client.ts');
    const dtoPath = path.join(domainPath, 'dtos', 'getData.dto.ts'); // Derived from service method name

    // Verify Service Method Name
    const serviceContent = mockFs.virtualFileSystem[servicePath];
    expect(serviceContent).toContain('async getData(dto: GetDataRequestDto)');

    // Verify Client Method Names
    const httpClientContent = mockFs.virtualFileSystem[httpClientPath];
    expect(httpClientContent).toContain('async fetchData(dto: GetDataRequestDto)');

    const dbClientContent = mockFs.virtualFileSystem[dbClientPath];
    expect(dbClientContent).toContain('async fetchData(dto: GetDataRequestDto)');

    // Verify DTO File Name and Content
    expect(mockFs.virtualFileSystem[dtoPath]).toBeDefined();
    const dtoContent = mockFs.virtualFileSystem[dtoPath];
    expect(dtoContent).toContain('export interface GetDataRequestDto');
  });
});