import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateZoneRuleDto {
  @ApiProperty({
    example: '66e6c8e1e4b0c2a5d3f89555',
    description: 'Zone rule ID to update',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  id: string;

  @ApiPropertyOptional({
    example: 'Indore Airport Zone',
    description: 'Zone name',
  })
  @IsOptional()
  @IsString()
  zoneName?: string;

  @ApiPropertyOptional({
    example: 4.0,
    description: 'Base Fare Surcharge ($)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseFareSurcharge?: number;

  @ApiPropertyOptional({
    example: 1.0,
    description: 'Multiplier (e.g. 1.0x, 1.1x)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  multiplier?: number;

  @ApiPropertyOptional({
    example: 'Active',
    enum: ['Active', 'Inactive'],
  })
  @IsOptional()
  @IsEnum(['Active', 'Inactive'])
  status?: string;

  @ApiPropertyOptional({
    example: '66e6be12e4b0c2a5d3f88999',
    description: 'Company ID (optional, SuperAdmin can specify)',
  })
  @IsOptional()
  @IsString()
  companyId?: string;
}
