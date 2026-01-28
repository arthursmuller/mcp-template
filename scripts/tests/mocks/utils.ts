import { jest } from '@jest/globals';

// 1. Get real implementation (Synchronous call)
const actualUtils = jest.requireActual<typeof import('../../utils.js')>('../../utils.js');

// 2. State tracking
let executionPromise: Promise<void> | undefined;

// 3. Define Mocks
export const askQuestion = jest.fn();
export const getReadLineInterface = jest.fn(() => ({ close: jest.fn() }));
export const logBanner = jest.fn();
export const logEndBanner = jest.fn();

// Pass through real implementations
export const toKebabCase = actualUtils.toKebabCase;
export const toCamelCase = actualUtils.toCamelCase;
export const toPascalCase = actualUtils.toPascalCase;
export const toSnakeCase = actualUtils.toSnakeCase;
export const getDomainsServicesWithDomainMap = actualUtils.getDomainsServicesWithDomainMap;

// 4. Special 'execute' mock
export const execute = jest.fn((rl: any, title: string, cb: () => Promise<void>) => {
  executionPromise = (async () => {
    try {
      await cb();
    } catch (err) {
      console.error("\n[FATAL ERROR]", err);
      process.exit(1);
    }
  })();
  return executionPromise;
});

// 5. Test Helpers (to access state)
export const __getExecutionPromise = () => executionPromise;
export const __resetExecutionPromise = () => { executionPromise = undefined; };