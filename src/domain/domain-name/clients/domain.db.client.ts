import { DomainExampleRequestDto, DomainExampleResponseDto } from "../dtos/domain.dto.js";

export class DomainDbClient  {
  async example(_: DomainExampleRequestDto): Promise<DomainExampleResponseDto | null> {
    return null;
  }
}