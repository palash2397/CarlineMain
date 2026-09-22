import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum CompanyTripStatusFilter {
  ALL = 'All',
  PENDING = 'Pending',
  DISPATCHED = 'Dispatched',
  ONGOING = 'Ongoing',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
  SCHEDULED = 'Scheduled',
}

export class GetCompanyTripsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 10,
    default: 10,
  })
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({
    description:
      'Search across trip ID, customer name, customer phone, driver name, pickup or dropoff address',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Trip status filter tab',
    enum: CompanyTripStatusFilter,
    default: CompanyTripStatusFilter.ALL,
    example: CompanyTripStatusFilter.ALL,
  })
  @IsOptional()
  @IsEnum(CompanyTripStatusFilter)
  status?: CompanyTripStatusFilter = CompanyTripStatusFilter.ALL;

  @ApiPropertyOptional({
    description: 'Start date filter (YYYY-MM-DD or ISO string)',
    example: '2026-09-01',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date filter (YYYY-MM-DD or ISO string)',
    example: '2026-09-22',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({
    description:
      'Company MongoDB ID (allowed for SuperAdmin to filter specific company trips)',
    example: '66e6be12e4b0c2a5d3f88999',
  })
  @IsOptional()
  @IsString()
  companyId?: string;
}
