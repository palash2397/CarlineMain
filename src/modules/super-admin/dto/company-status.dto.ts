import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty } from 'class-validator';

export class CompanyStatusDto {
  @ApiProperty({ description: 'The ID of the company' })
  @IsMongoId()
  @IsNotEmpty()
  id: string;
}
