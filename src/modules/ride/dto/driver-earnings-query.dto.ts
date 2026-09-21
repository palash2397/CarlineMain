import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum EarningsRange {
  TODAY = 'TODAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  ALL = 'ALL',
}

export class DriverEarningsQueryDto {
  @ApiPropertyOptional({
    enum: EarningsRange,
    default: EarningsRange.WEEK,
    description: 'Window used for the daily breakdown and range totals',
  })
  @IsOptional()
  @IsEnum(EarningsRange)
  range?: EarningsRange;
}