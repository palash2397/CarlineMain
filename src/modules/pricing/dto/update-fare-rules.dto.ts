import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateFareRulesDto {
  @ApiProperty({
    example: 4.5,
    description: 'Base Fare ($)',
    required: true,
  })
  @IsNumber()
  @Min(0)
  baseFare: number;

  @ApiProperty({
    example: 7.5,
    description: 'Minimum Fare ($)',
    required: true,
  })
  @IsNumber()
  @Min(0)
  minimumFare: number;

  @ApiProperty({
    example: 1.8,
    description: 'Per Kilometer Rate ($)',
    required: true,
  })
  @IsNumber()
  @Min(0)
  perKmRate: number;

  @ApiProperty({
    example: 0.4,
    description: 'Per Minute (Time) Rate ($)',
    required: true,
  })
  @IsNumber()
  @Min(0)
  perMinuteRate: number;

  @ApiPropertyOptional({
    example: '66e6be12e4b0c2a5d3f88999',
    description: 'Company ID (optional, SuperAdmin can specify)',
  })
  @IsOptional()
  companyId?: string;
}
