import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

import { RideStatus } from 'src/common/enums/ride/ride-status.enum';

export class MyRidesQueryDto {
  @ApiPropertyOptional({ enum: RideStatus, description: 'Filter by ride status' })
  @IsOptional()
  @IsEnum(RideStatus)
  status?: RideStatus;

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
