// 1. Export specific mock functions (spies) so tests can control/assert on them
export const exampleSpy = jest.fn();

// 2. Export the Mock Class structure matching the real Client
export class DomainHttpClient {
  // Map the class method to the shared spy
  example = exampleSpy;
}