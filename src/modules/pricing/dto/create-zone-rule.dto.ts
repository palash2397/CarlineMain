import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateZoneRuleDto {
  @ApiProperty({
    example: 'Indore Airport Zone',
    description: 'Zone name',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  zoneName: string;

  @ApiProperty({
    example: 4.0,
    description: 'Base Fare Surcharge ($)',
    required: true,
  })
  @IsNumber()
  @Min(0)
  baseFareSurcharge: number;

  @ApiProperty({
    example: 1.0,
    description: 'Multiplier (e.g. 1.0x, 1.1x)',
    required: true,
  })
  @IsNumber()
  @Min(0.1)
  multiplier: number;

  @ApiPropertyOptional({
    example: 'Active',
    enum: ['Active', 'Inactive'],
    default: 'Active',
  })
  @IsOptional()
  @IsEnum(['Active', 'Inactive'])
  status?: string;

  @ApiPropertyOptional({
    example: '66e6be12e4b0c2a5d3f88999',
    description: 'Company ID (optional, SuperAdmin can specify)',
  })
  @IsOptional()
  companyId?: string;
}
