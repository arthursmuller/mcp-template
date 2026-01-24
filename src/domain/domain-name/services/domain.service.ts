import { DomainHttpClient } from "../clients/domain.http.client.js";
import { DomainExampleRequestDto, DomainExampleResponseDto } from "../dtos/domain.dto.js";

export class DomainService {
  constructor(private readonly httpClient: DomainHttpClient) { }

  async example(exampleParam: DomainExampleRequestDto): Promise<DomainExampleResponseDto | null> {
    const data = await this.httpClient.example(exampleParam);
    return data;
  }
}

export default new DomainService(new DomainHttpClient());