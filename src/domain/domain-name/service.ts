import HttpClient from "../../api/client.js";
import { DomainExampleRequestDto, DomainExampleResponseDto } from "./dtos/domain.dto.js";
import { getHeaders } from "./utils/api.js";

export class DomainService {
  constructor(private readonly httpClient: HttpClient) {}

  async example(exampleParam: DomainExampleRequestDto): Promise<DomainExampleResponseDto | null> {
    try {
      const data = await this.httpClient.post<DomainExampleResponseDto>("/", { ...exampleParam });
      return data;
    } catch (e) {
      console.error(`Failed to execute query: `, e);
      return null;
    }
  }
}

export default new DomainService(new HttpClient(getHeaders()));