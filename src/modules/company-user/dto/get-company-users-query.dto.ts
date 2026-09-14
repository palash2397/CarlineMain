import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetCompanyUsersQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number for pagination',
    default: 1,
  })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of records per page',
    default: 10,
  })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    example: 'Rahul',
    description: 'Search by full name or email',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'DISPATCHER',
    description: 'Filter by role',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    example: 'Active',
    description: 'Filter by status (All, Active, Inactive)',
    enum: ['All', 'Active', 'Inactive'],
  })
  @IsOptional()
  @IsString()
  status?: string;
}
