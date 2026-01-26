import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

class HttpClient {
  private client: AxiosInstance;

  constructor(baseUrl: string, headers?: Record<string, string>) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
      headers: headers
    });
  }

  async post<T = any>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const headers = {
        ...(config?.headers || {}),
      };
      
      const response = await this.client.post<T>(path, data, { ...config, headers });
      return response.data;
    } catch (error) {
      console.error("HTTP POST failed:", error);
      throw error;
    }
  }
   async get<T = any>(path: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const headers = {
        ...(config?.headers || {}),
      };
      
      const response = await this.client.get<T>(path, { ...config, headers });
      return response.data;
    } catch (error) {
      console.error("HTTP GET failed:", error);
      throw error;
    }
  }
}

export default HttpClient;