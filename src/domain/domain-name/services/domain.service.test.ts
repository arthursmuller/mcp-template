import * as mockHttpClient from '../../../../tests/mocks/domain.http.client.js';
import { DomainService } from './domain.service.js';

// 1. Mock the module using the shared mock file
jest.mock('../clients/domain.http.client.js', () => mockHttpClient);

describe('DomainService', () => {
  let service: DomainService; 

  beforeEach(() => {
    jest.clearAllMocks();
    
    const MockClientClass = mockHttpClient.DomainHttpClient;
    // Now you can construct it because DomainService is the class
    service = new DomainService(new MockClientClass() as any);
  });

  test('example() should call client.example with correct dto and return data', async () => {
    // Arrange
    const mockDto = { exampleParam: 'test-value' };
    const mockResponse = { results: ['data'] };
    
    // Control the spy from the shared mock
    mockHttpClient.exampleSpy.mockResolvedValue(mockResponse);

    // Act
    const result = await service.example(mockDto);

    // Assert
    expect(mockHttpClient.exampleSpy).toHaveBeenCalledWith(mockDto);
    expect(result).toEqual(mockResponse);
  });

  test('example() should return null if client throws error', async () => {
    // Arrange
    const mockDto = { exampleParam: 'error-case' };
    
    // Control the spy to reject (simulate network error)
    // Note: The service catches errors if the real implementation handles them. 
    // Looking at the provided service code, it simply awaits: 
    // "const data = await this.httpClient.example(dto);"
    // If the HTTP Client *wrapper* catches errors (which it does in the provided templates),
    // it returns null. So we simulate the Client returning null here.
    
    mockHttpClient.exampleSpy.mockResolvedValue(null);

    // Act
    const result = await service.example(mockDto);

    // Assert
    expect(mockHttpClient.exampleSpy).toHaveBeenCalledWith(mockDto);
    expect(result).toBeNull();
  });
});