import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import env from "../env.js";

class HttpClient {
  private client: AxiosInstance;

  constructor(headers?: Record<string, string>) {
    this.client = axios.create({
      baseURL: env.API.Url,
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
}

export default HttpClient;