import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DeleteZoneRuleDto {
  @ApiProperty({
    example: '66e6c8e1e4b0c2a5d3f89555',
    description: 'Zone rule ID to delete',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  id: string;

  @ApiPropertyOptional({
    example: '66e6be12e4b0c2a5d3f88999',
    description: 'Company ID (optional, SuperAdmin can specify)',
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  ruleId?: string;
  _id?: string;
}

