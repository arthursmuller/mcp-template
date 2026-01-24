import { DomainExampleRequestDto, DomainExampleResponseDto } from "../dtos/domain.dto.js";

export class DomainDbClient  {
  async example(exampleParam: DomainExampleRequestDto): Promise<DomainExampleResponseDto | null> {
    return null;
  }
}