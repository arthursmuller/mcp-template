import * as fs from 'fs';
import * as path from 'path';
import { MockFileSystem, abs } from '../utils/file-system.js';
import * as mockUtils from '../mocks/utils.js';

jest.mock('../../scripts/utils.js', () => mockUtils);
jest.mock('fs');

describe('Scaffold Client Script', () => {
  let mockFs: MockFileSystem;

  // Helpers from our mock file
  const { __getExecutionPromise, __resetExecutionPromise, askQuestion } = mockUtils as any;

  const domainPath = abs('src/domain/weather-data');
  const servicePath = path.join(domainPath, 'services', 'weather.service.ts');

  beforeEach(() => {
    jest.clearAllMocks();
    __resetExecutionPromise(); // Reset mock state
    
    // Initialize VFS
    mockFs = new MockFileSystem({
      [abs('src/domain')]: 'DIRECTORY',
      [abs('src/domain/weather-data')]: 'DIRECTORY',
      [abs('src/domain/weather-data/services')]: 'DIRECTORY',
      [servicePath]: 'export class WeatherService {}', 
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
      await import('../../scripts/scaffold-client.js');
    });
    
    // Wait for the script execution logic captured by our mock
    const promise = __getExecutionPromise();
    if (promise) await promise;
  };

  test('1. Should generate an HTTP Client with custom method name and create missing utils/api.ts (Full Content Check)', async () => {
    askQuestion
      .mockResolvedValueOnce('1')           // Domain
      .mockResolvedValueOnce('1')           // HTTP
      .mockResolvedValueOnce('open-meteo')  // Name
      .mockResolvedValueOnce('get-forecast');// Method

    await runScript();

    const clientsDir = path.join(domainPath, 'clients');
    const utilsDir = path.join(domainPath, 'utils');
    const clientFile = path.join(clientsDir, 'open-meteo.http.client.ts');
    const apiUtilFile = path.join(utilsDir, 'api.ts');

    expect(mockFs.trackedDirs).toContain(clientsDir);
    expect(mockFs.trackedDirs).toContain(utilsDir);
    expect(mockFs.virtualFileSystem[clientFile]).toBeDefined();
    expect(mockFs.virtualFileSystem[apiUtilFile]).toBeDefined();
    
    // Verify exact content of the HTTP Client file
    const expectedClientContent = `
import HttpClient from "../../../api/client.js";
import env from "../../../env.js";
import { getHeaders } from "../utils/api.js";

export class OpenMeteoHttpClient {
  private readonly httpClient: HttpClient;

  constructor() {
    this.httpClient = new HttpClient(env.API.Url, getHeaders());
  }

  async getForecast(dto: any): Promise<any> {
    // TODO: Define DTOs for dto and return type
    // return this.httpClient.post("/", dto);
    return null;
  }
}
`.trim();
    expect(mockFs.virtualFileSystem[clientFile].trim()).toBe(expectedClientContent);

    // Verify exact content of the Utils file
    const expectedUtilsContent = `
import env from "../../../env.js";

export function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  // headers["Authorization"] = env.API.headers.ApiKey;
  return headers;
}
`.trim();
    expect(mockFs.virtualFileSystem[apiUtilFile].trim()).toBe(expectedUtilsContent);
  });

  test('2. Should generate a DB Client with default method name (Full Content Check)', async () => {
    askQuestion
      .mockResolvedValueOnce('1')           // Domain
      .mockResolvedValueOnce('2')           // DB
      .mockResolvedValueOnce('user-db')     // Name
      .mockResolvedValueOnce('');           // Default Method (empty string -> getData)

    await runScript();

    const clientFile = path.join(domainPath, 'clients', 'user-db.db.client.ts');
    expect(mockFs.virtualFileSystem[clientFile]).toBeDefined();
    
    // Verify exact content of the DB Client file
    const expectedDbClientContent = `
export class UserDbDbClient {
  async getData(id: string): Promise<any | null> {
    // TODO: Implement database logic
    return null;
  }
}
`.trim();
    expect(mockFs.virtualFileSystem[clientFile].trim()).toBe(expectedDbClientContent);
  });

  test('3. Should not overwrite existing utils/api.ts', async () => {
    const apiUtilFile = path.join(domainPath, 'utils', 'api.ts');
    mockFs.virtualFileSystem[apiUtilFile] = '// Original';

    askQuestion
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce('test')
      .mockResolvedValueOnce('test');

    await runScript();

    expect(mockFs.virtualFileSystem[apiUtilFile]).toBe('// Original');
  });

  test('4. Should exit gracefully if no domains are found', async () => {
    mockFs.virtualFileSystem = {}; 
    mockFs.virtualFileSystem[abs('src/domain')] = 'DIRECTORY';

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await runScript();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FATAL ERROR]'), 
        expect.objectContaining({ message: expect.stringContaining('No domains found') })
    );
    expect(mockExit).toHaveBeenCalledWith(1); 
  });

  test('5. Should handle invalid selection inputs', async () => {
    askQuestion
        .mockResolvedValueOnce('99')    // Invalid Index
        .mockResolvedValueOnce('1')     // Dummy Type
        .mockResolvedValueOnce('dummy') // Dummy Name
        .mockResolvedValueOnce('dummy');// Dummy Method
    
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await runScript();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FATAL ERROR]'),
        expect.objectContaining({ message: expect.stringContaining('Invalid domain selection') })
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test('6. Should throw error on invalid client type selection', async () => {
    askQuestion
      .mockResolvedValueOnce('1')      // Valid Domain
      .mockResolvedValueOnce('3')      // Invalid Type
      .mockResolvedValueOnce('name')   // Name (needed to complete prompt loop)
      .mockResolvedValueOnce('');      // Method (needed to complete prompt loop)
  
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  
    await runScript();
  
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[FATAL ERROR]'),
      expect.objectContaining({ message: expect.stringContaining('Invalid client type') })
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test('7. Should throw error on empty client name', async () => {
    askQuestion
      .mockResolvedValueOnce('1') // Valid Domain
      .mockResolvedValueOnce('1') // Valid Type
      .mockResolvedValueOnce('')  // Empty Name (Invalid)
      .mockResolvedValueOnce(''); // Method (needed to complete prompt loop)
  
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  
    await runScript();
  
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[FATAL ERROR]'),
      expect.objectContaining({ message: expect.stringContaining('Client name is required') })
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});