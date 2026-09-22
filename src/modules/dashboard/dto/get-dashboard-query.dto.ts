import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum DashboardTimeframe {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  CUSTOM = 'custom',
}

export class GetDashboardQueryDto {
  @ApiPropertyOptional({
    description:
      'Company MongoDB ID (Allowed for Super Admin to inspect a specific company)',
    example: '66e6be12e4b0c2a5d3f88999',
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Timeframe period for metrics calculation',
    enum: DashboardTimeframe,
    default: DashboardTimeframe.TODAY,
    example: DashboardTimeframe.TODAY,
  })
  @IsOptional()
  @IsEnum(DashboardTimeframe)
  timeframe?: DashboardTimeframe = DashboardTimeframe.TODAY;

  @ApiPropertyOptional({
    description:
      'Start Date (YYYY-MM-DD or ISO string) when timeframe is "custom"',
    example: '2026-09-01',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      'End Date (YYYY-MM-DD or ISO string) when timeframe is "custom"',
    example: '2026-09-22',
  })
  @IsOptional()
  @IsString()
  endDate?: string;
}
