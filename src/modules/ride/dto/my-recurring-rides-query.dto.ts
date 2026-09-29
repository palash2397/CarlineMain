import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import { RecurringStatus } from 'src/common/enums/ride/recurring-status.enum';

export class MyRecurringRidesQueryDto {
  @ApiPropertyOptional({
    enum: RecurringStatus,
    description: 'Filter by series status',
  })
  @IsOptional()
  @IsEnum(RecurringStatus)
  status?: RecurringStatus;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 10, default: 10, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
