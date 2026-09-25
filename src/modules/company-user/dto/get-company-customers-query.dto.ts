import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum CompanyCustomerStatusFilter {
  ALL = 'All',
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
}

export class GetCompanyCustomersQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @IsString()
  page?: string = '1';

  @ApiPropertyOptional({
    description: 'Number of customers per page',
    default: 10,
    example: 10,
  })
  @IsOptional()
  @IsString()
  limit?: string = '10';

  @ApiPropertyOptional({
    description:
      'Search query across customer name, phone number, and email address',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter customers by active status',
    enum: CompanyCustomerStatusFilter,
    default: CompanyCustomerStatusFilter.ALL,
    example: CompanyCustomerStatusFilter.ALL,
  })
  @IsOptional()
  @IsEnum(CompanyCustomerStatusFilter)
  status?: CompanyCustomerStatusFilter = CompanyCustomerStatusFilter.ALL;

  @ApiPropertyOptional({
    description:
      'Company MongoDB ID or Company Code (Allowed for Super Admin to inspect a specific company)',
    example: '66e6be12e4b0c2a5d3f88999',
  })
  @IsOptional()
  @IsString()
  companyId?: string;
}
