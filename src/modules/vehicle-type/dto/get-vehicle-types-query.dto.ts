import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class GetVehicleTypesQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number for pagination',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of items per page',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'Sedan',
    description: 'Search by vehicle name, badge, or description',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'Active',
    enum: ['All', 'Active', 'Inactive'],
    description: 'Filter by status',
    default: 'All',
  })
  @IsOptional()
  @IsEnum(['All', 'Active', 'Inactive'])
  status?: string = 'All';
}
