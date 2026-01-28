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

  const toolsTsPath = abs('src/mcp/tools.ts');
  const toolsMetaPath = abs('src/tools.metadata.ts');
  const envPath = abs('src/env.ts');

  // Helper to init FS
  const initFileSystem = (files: Record<string, string> = {}) => {
    mockFs = new MockFileSystem({
      [toolsMetaPath]: BASE_METADATA,
      [envPath]: BASE_ENV,
      [toolsTsPath]: BASE_MCP_TOOLS,
      
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

  test('1. Should generate Tool with HTTP Client integration (Exact Content)', async () => {
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
    const expectedMetadata = `const toolMetadata = {
  existing_tool: {
    name: "existing_tool",
    description: "Existing description",
  },
  get_forecast: {
    name: "get_forecast",
    description: \`Get weather forecast\`,
  },
}

export default toolMetadata;`;
    expect(mockFs.virtualFileSystem[toolsMetaPath].trim()).toBe(expectedMetadata.trim());

    // 2. Check Env
    const expectedEnv = `import toolMetadata from "./tools.metadata.js";

const env = {
  SERVER_NAME: "test-server",
  TOOLS_ENABLED: [
    process.env.EXISTING_TOOL === "false" ? null : toolMetadata.existing_tool.name,
    process.env.GET_FORECAST === "false" ? null : toolMetadata.get_forecast.name,
  ].filter(element => element !== null),
}

export default env;`;
    expect(mockFs.virtualFileSystem[envPath].trim()).toBe(expectedEnv.trim());

    // 3. Check DTO
    const dtoPath = path.join(dtosDir, 'getForecast.dto.ts');
    expect(mockFs.virtualFileSystem[dtoPath]).toBeDefined();
    const expectedDto = `export interface GetForecastRequestDto {
  // TODO: Add properties
}

export interface GetForecastResponseDto {
  // TODO: Add properties
}
`;
    expect(mockFs.virtualFileSystem[dtoPath].trim()).toBe(expectedDto.trim());

    // 4. Check Service Update
    const expectedService = `import { GetForecastRequestDto, GetForecastResponseDto } from "../dtos/getForecast.dto.js";
export class WeatherService {
  constructor() {}

  async getForecast(dto: GetForecastRequestDto): Promise<GetForecastResponseDto | null> {
    // TODO: Implement logic
    // Example: const data = await this.httpClient.fetchForecast(dto);
    // return data;

    return null;
  }
}`;
    expect(mockFs.virtualFileSystem[weatherServicePath].trim()).toBe(expectedService.trim());

    // 5. Check HTTP Client Update
    const expectedClient = `import { GetForecastRequestDto, GetForecastResponseDto } from "../dtos/getForecast.dto.js";
export class WeatherHttpClient {
  constructor() {}

  async fetchForecast(dto: GetForecastRequestDto): Promise<GetForecastResponseDto | null> {
    // TODO: Implement HTTP Request
    // return this.httpClient.post<GetForecastResponseDto>("/path", dto);
    return null;
  }
}`;
    expect(mockFs.virtualFileSystem[weatherHttpPath].trim()).toBe(expectedClient.trim());

    // 6. Check MCP Registry (src/mcp/tools.ts)
    const expectedTools = `import WeatherService from "../domain/weather/services/weather.service.js";
import z from "zod";
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
  [toolMetadata.get_forecast.name]: {
    name: toolMetadata.get_forecast.name,
    description: toolMetadata.get_forecast.description,
    inputSchema: {
      // TODO: Define Zod schema based on GetForecastRequestDto
      // param: z.string(),
    },
    callback: buildTool(WeatherService.getForecast.bind(WeatherService)),
  },
}

export default tools;`;
    // We normalize slashes to handle potential OS differences in the generated import path during test
    const actualTools = mockFs.virtualFileSystem[toolsTsPath].replace(/\\/g, '/');
    expect(actualTools.trim()).toBe(expectedTools.trim());
  });

  test('2. Should generate Tool with DB Client integration (Exact Content)', async () => {
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
    const expectedDb = `import { GetUserRequestDto, GetUserResponseDto } from "../dtos/getUser.dto.js";
export class WeatherDbClient {
  constructor() {}

  async queryUser(dto: GetUserRequestDto): Promise<GetUserResponseDto | null> {
    // TODO: Implement DB Operation
    return null;
  }
}`;
    expect(mockFs.virtualFileSystem[weatherDbPath].trim()).toBe(expectedDb.trim());

    // Check Service File
    const expectedService = `import { GetUserRequestDto, GetUserResponseDto } from "../dtos/getUser.dto.js";
export class WeatherService {
  constructor() {}

  async getUser(dto: GetUserRequestDto): Promise<GetUserResponseDto | null> {
    // TODO: Implement logic
    // Example: const data = await this.dbClient.queryUser(dto);
    // return data;

    return null;
  }
}`;
    expect(mockFs.virtualFileSystem[weatherServicePath].trim()).toBe(expectedService.trim());
  });

  test('3. Should generate Tool with NO clients (Exact Content)', async () => {
    initFileSystem();

    askQuestion
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce('calc')
      .mockResolvedValueOnce('calc_tool')
      .mockResolvedValueOnce('Calculate stuff')
      .mockResolvedValueOnce('n'); // HTTP? No
      // DB prompt skipped implicitly because getClients returned empty array for DB in initFileSystem

    await runScript();

    const expectedService = `import { CalcRequestDto, CalcResponseDto } from "../dtos/calc.dto.js";
export class WeatherService {
  constructor() {}

  async calc(dto: CalcRequestDto): Promise<CalcResponseDto | null> {
    // TODO: Implement logic

    return null;
  }
}`;
    expect(mockFs.virtualFileSystem[weatherServicePath].trim()).toBe(expectedService.trim());
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

  test('5. Should correctly insert comma in tools.ts if missing', async () => {
    // Setup tools.ts where the last entry MISSES a comma
    const TOOLS_WITHOUT_COMMA = `const tools: Record<string, ToolDefinition> = {
  [toolMetadata.existing_tool.name]: {
    name: "existing",
    callback: () => {}
  }
}
export default tools;`;

    initFileSystem({
        [toolsTsPath]: TOOLS_WITHOUT_COMMA
    });

    askQuestion
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce('comma-test')
      .mockResolvedValueOnce('comma_tool')
      .mockResolvedValueOnce('Desc')
      .mockResolvedValueOnce('n');

    await runScript();

    const actualTools = mockFs.virtualFileSystem[toolsTsPath].replace(/\\/g, '/');
    
    // Check that a comma was inserted after the first tool block
    expect(actualTools).toContain(`callback: () => {}\n  },`);
    
    // Check full structure
    const expectedPart = `
  [toolMetadata.comma_tool.name]: {
    name: toolMetadata.comma_tool.name,
    description: toolMetadata.comma_tool.description,
    inputSchema: {
      // TODO: Define Zod schema based on CommaTestRequestDto
      // param: z.string(),
    },
    callback: buildTool(WeatherService.commaTest.bind(WeatherService)),
  },
}
export default tools;`;
    expect(actualTools).toContain(expectedPart.trim());
  });
});