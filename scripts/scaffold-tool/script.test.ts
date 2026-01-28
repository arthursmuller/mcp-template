import * as fs from 'fs';
import * as path from 'path';
import { MockFileSystem, abs } from '../tests/utils/file-system.js';
import * as mockUtils from '../tests/mocks/utils.js';

jest.mock('../utils.js', () => mockUtils);
jest.mock('fs');

// --- Base File Content Constants ---

const BASE_METADATA = `const toolMetadata = {
  existing_tool: {
    name: "existing_tool",
    description: "Existing description",
  },
}

export default toolMetadata;`;

const BASE_ENV = `import toolMetadata from "./tools.metadata.js";

const env = {
  SERVER_NAME: "test-server",
  TOOLS_ENABLED: [
    process.env.EXISTING_TOOL === "false" ? null : toolMetadata.existing_tool.name,
  ].filter(element => element !== null),
}

export default env;`;

const BASE_MCP_TOOLS = `import z from "zod";
import { ToolDefinition } from "./utils/dtos.js";
import toolMetadata from "../tools.metadata.js";
import buildTool from "./utils/newTool.js";
import OtherService from "../domain/other/services/other.service.js";

const tools: Record<string, ToolDefinition> = {
  [toolMetadata.existing_tool.name]: {
    name: toolMetadata.existing_tool.name,
    description: toolMetadata.existing_tool.description,
    inputSchema: {
      param: z.string(),
    },
    callback: buildTool(OtherService.existingMethod.bind(OtherService)),
  },
}

export default tools;`;

const WEATHER_SERVICE = `export class WeatherService {
  constructor() {}
}`;

const WEATHER_HTTP_CLIENT = `export class WeatherHttpClient {
  constructor() {}
}`;

const WEATHER_DB_CLIENT = `export class WeatherDbClient {
  constructor() {}
}`;

describe('Scaffold Tool Script', () => {
  let mockFs: MockFileSystem;

  // Helpers from mockUtils
  const { __getExecutionPromise, __resetExecutionPromise, askQuestion } = mockUtils as any;

  // Paths
  const domainDir = abs('src/domain/weather');
  const servicesDir = path.join(domainDir, 'services');
  const clientsDir = path.join(domainDir, 'clients');
  const dtosDir = path.join(domainDir, 'dtos');
  
  const weatherServicePath = path.join(servicesDir, 'weather.service.ts');
  const weatherHttpPath = path.join(clientsDir, 'weather.http.client.ts');
  const weatherDbPath = path.join(clientsDir, 'weather.db.client.ts');

  // Helper to init FS
  const initFileSystem = (files: Record<string, string> = {}) => {
    mockFs = new MockFileSystem({
      [abs('src/tools.metadata.ts')]: BASE_METADATA,
      [abs('src/env.ts')]: BASE_ENV,
      [abs('src/mcp/tools.ts')]: BASE_MCP_TOOLS,
      
      [abs('src/domain')]: 'DIRECTORY',
      [domainDir]: 'DIRECTORY',
      [servicesDir]: 'DIRECTORY',
      [clientsDir]: 'DIRECTORY',
      [dtosDir]: 'DIRECTORY',
      
      // Default domain files
      [weatherServicePath]: WEATHER_SERVICE,
      [weatherHttpPath]: WEATHER_HTTP_CLIENT,
      
      ...files
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

  test('1. Should generate Tool with HTTP Client integration (Full Content Check)', async () => {
    initFileSystem();

    askQuestion
      .mockResolvedValueOnce('1')             // 1. Select Domain (WeatherService)
      .mockResolvedValueOnce('get-forecast')  // 2. Method Name
      .mockResolvedValueOnce('get_forecast')  // 3. Tool Name
      .mockResolvedValueOnce('Get weather forecast') // 4. Description
      .mockResolvedValueOnce('y')             // 5. Add HTTP Client? Yes
      .mockResolvedValueOnce('fetch-forecast');// 6. HTTP Client Method Name
      
    await runScript();

    // 1. Check Metadata
    const metadata = mockFs.virtualFileSystem[abs('src/tools.metadata.ts')];
    expect(metadata).toContain('get_forecast: {');
    expect(metadata).toContain('name: "get_forecast",');
    expect(metadata).toContain('description: `Get weather forecast`,');

    // 2. Check Env
    const env = mockFs.virtualFileSystem[abs('src/env.ts')];
    expect(env).toContain('process.env.GET_FORECAST === "false" ? null : toolMetadata.get_forecast.name,');

    // 3. Check DTO
    // Note: script.ts converts method 'getForecast' -> 'GetforecastRequestDto' due to toPascalCase behavior on camelCase strings
    const dtoPath = path.join(dtosDir, 'getForecast.dto.ts');
    expect(mockFs.virtualFileSystem[dtoPath]).toBeDefined();
    const dtoContent = mockFs.virtualFileSystem[dtoPath];
    expect(dtoContent).toContain('export interface GetforecastRequestDto');
    expect(dtoContent).toContain('export interface GetforecastResponseDto');

    // 4. Check Service Update
    const serviceContent = mockFs.virtualFileSystem[weatherServicePath];
    const expectedServiceImport = `import { GetforecastRequestDto, GetforecastResponseDto } from "../dtos/getForecast.dto.js";\n`;
    const expectedServiceMethod = `
  async getForecast(dto: GetforecastRequestDto): Promise<GetforecastResponseDto | null> {
    // TODO: Implement logic
    // Example: const data = await this.httpClient.fetchForecast(dto);
    // return data;
    return null;
  }
`;
    expect(serviceContent).toContain(expectedServiceImport.trim());
    expect(serviceContent.replace(/\s+/g, ' ')).toContain(expectedServiceMethod.trim().replace(/\s+/g, ' '));

    // 5. Check HTTP Client Update
    const clientContent = mockFs.virtualFileSystem[weatherHttpPath];
    const expectedClientMethod = `
  async fetchForecast(dto: GetforecastRequestDto): Promise<GetforecastResponseDto | null> {
    // TODO: Implement HTTP Request
    // return this.httpClient.post<GetforecastResponseDto>("/path", dto);
    return null;
  }
`;
    expect(clientContent).toContain('import { GetforecastRequestDto, GetforecastResponseDto } from "../dtos/getForecast.dto.js";');
    expect(clientContent.replace(/\s+/g, ' ')).toContain(expectedClientMethod.trim().replace(/\s+/g, ' '));

    // 6. Check MCP Registry (src/mcp/tools.ts)
    const mcpTools = mockFs.virtualFileSystem[abs('src/mcp/tools.ts')];
    
    // Check Import Injection
    expect(mcpTools).toContain(`import WeatherService from "../domain/weather/services/weather.service.js";`);
    
    // Check Tool Definition
    expect(mcpTools).toContain('[toolMetadata.get_forecast.name]: {');
    expect(mcpTools).toContain('callback: buildTool(WeatherService.getForecast.bind(WeatherService)),');
  });

  test('2. Should generate Tool with DB Client integration', async () => {
    // Add DB Client to FS
    initFileSystem({
        [weatherDbPath]: WEATHER_DB_CLIENT
    });

    askQuestion
      .mockResolvedValueOnce('1')             // Domain
      .mockResolvedValueOnce('get-user')      // Method
      .mockResolvedValueOnce('get_user')      // Tool
      .mockResolvedValueOnce('Get user data') // Desc
      .mockResolvedValueOnce('n')             // HTTP? No
      .mockResolvedValueOnce('y')             // DB? Yes
      .mockResolvedValueOnce('query-user');   // DB Method

    await runScript();

    // Check DB Client File
    const dbContent = mockFs.virtualFileSystem[weatherDbPath];
    // Note: get-user -> getUser -> GetuserRequestDto
    expect(dbContent).toContain('import { GetuserRequestDto, GetuserResponseDto } from "../dtos/getUser.dto.js";');
    expect(dbContent).toContain('async queryUser(dto: GetuserRequestDto): Promise<GetuserResponseDto | null>');

    // Check Service File (should show DB example comment)
    const serviceContent = mockFs.virtualFileSystem[weatherServicePath];
    expect(serviceContent).toContain('// Example: const data = await this.dbClient.queryUser(dto);');
  });

  test('3. Should generate Tool with NO clients (Service Logic only)', async () => {
    initFileSystem();

    askQuestion
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce('calc')
      .mockResolvedValueOnce('calc_tool')
      .mockResolvedValueOnce('Calculate stuff')
      .mockResolvedValueOnce('n'); // HTTP? No
      // DB prompt skipped as no DB client in default initFileSystem

    await runScript();

    const serviceContent = mockFs.virtualFileSystem[weatherServicePath];
    // Should NOT contain client calls in comments if we selected none
    expect(serviceContent).not.toContain('this.httpClient');
    expect(serviceContent).not.toContain('this.dbClient');
    expect(serviceContent).toContain('async calc(dto: CalcRequestDto)');
  });

  test('4. Should exit gracefully if no domains are found', async () => {
    // Empty domains
    mockFs = new MockFileSystem({
        [abs('src/domain')]: 'DIRECTORY'
    });
    (fs.existsSync as jest.Mock).mockImplementation(mockFs.existsSync);
    (fs.readdirSync as jest.Mock).mockImplementation(mockFs.readdirSync);

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await runScript();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FATAL ERROR]'),
        expect.objectContaining({ message: expect.stringContaining('No domains found') })
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test('5. Should handle existing imports in tools.ts correctly', async () => {
    // Setup tools.ts that ALREADY imports the service
    // Crucial: Add a newline inside the object definition to match the regex (\n})
    const PRE_IMPORTED_TOOLS = `import z from "zod";
import { ToolDefinition } from "./utils/dtos.js";
import toolMetadata from "../tools.metadata.js";
import buildTool from "./utils/newTool.js";
import WeatherService from "../domain/weather/services/weather.service.js"; // Already here

const tools: Record<string, ToolDefinition> = {
};
export default tools;`;

    initFileSystem({
        [abs('src/mcp/tools.ts')]: PRE_IMPORTED_TOOLS
    });

    askQuestion
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce('new-method')
      .mockResolvedValueOnce('new_tool')
      .mockResolvedValueOnce('Desc')
      .mockResolvedValueOnce('n'); // No clients

    await runScript();

    const mcpTools = mockFs.virtualFileSystem[abs('src/mcp/tools.ts')];
    
    // Should NOT duplicate the import
    const matches = mcpTools.match(/import WeatherService/g);
    expect(matches?.length).toBe(1);

    // Should still add the tool
    expect(mcpTools).toContain('[toolMetadata.new_tool.name]: {');
  });

  test('6. Should handle multiple clients selection', async () => {
    // Add multiple HTTP clients
    const HTTP_CLIENT_2 = `export class AnotherHttpClient {}`;
    initFileSystem({
        [path.join(clientsDir, 'another.http.client.ts')]: HTTP_CLIENT_2
    });

    askQuestion
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce('multi')
      .mockResolvedValueOnce('multi_tool')
      .mockResolvedValueOnce('Desc')
      .mockResolvedValueOnce('y') // Yes HTTP
      .mockResolvedValueOnce('2') // Select 2nd client (AnotherHttpClient)
      .mockResolvedValueOnce('do-http'); 

    await runScript();

    // Verify 'another.http.client.ts' was updated
    const clientContent = mockFs.virtualFileSystem[path.join(clientsDir, 'another.http.client.ts')];
    expect(clientContent).toContain('async doHttp(dto: MultiRequestDto)');
    
    // Verify default 'weather.http.client.ts' was NOT updated
    const originalClient = mockFs.virtualFileSystem[weatherHttpPath];
    expect(originalClient).not.toContain('async doHttp');
  });
});