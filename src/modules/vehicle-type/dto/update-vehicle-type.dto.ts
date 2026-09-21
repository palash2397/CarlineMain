import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateVehicleTypeDto {
  @ApiPropertyOptional({
    example: 'Sedan Comfort Plus',
    description: 'Vehicle class name',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 4,
    description: 'Passenger seating capacity',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  seats?: number;

  @ApiPropertyOptional({
    example: 'POPULAR',
    description: 'Promotional badge (e.g. POPULAR, ECO, VIP)',
  })
  @IsOptional()
  @IsString()
  badge?: string;

  @ApiPropertyOptional({
    example: '3-5 min',
    description: 'Estimated pickup time display text',
  })
  @IsOptional()
  @IsString()
  etaText?: string;

  @ApiPropertyOptional({
    example: 18.3,
    description: 'Base starting price ($)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional({
    example: 1.8,
    description: 'Per kilometer rate ($)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  perKmRate?: number;

  @ApiPropertyOptional({
    example: 0.4,
    description: 'Per minute rate ($)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  perMinuteRate?: number;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Replacement vehicle photo/icon file (png, jpg, jpeg, webp, svg)',
  })
  @IsOptional()
  image?: any;

  @ApiPropertyOptional({
    example: 'https://example.com/sedan.jpg',
    description: 'Direct vehicle image URL',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    example: 'Comfortable everyday sedan rides with AC',
    description: 'Vehicle class description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'Active',
    enum: ['Active', 'Inactive'],
  })
  @IsOptional()
  @IsEnum(['Active', 'Inactive'])
  status?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Display order priority',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;
}
