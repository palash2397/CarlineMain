import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { RecurringStatus } from 'src/common/enums/ride/recurring-status.enum';

// PAUSE stops the series for a while, ACTIVE resumes it and CANCELLED closes
// the series for good.
export class UpdateRecurringRideStatusDto {
  @ApiProperty({
    enum: RecurringStatus,
    example: RecurringStatus.PAUSED,
    description:
      'ACTIVE to resume, PAUSED to hold, CANCELLED to close the series',
  })
  @IsEnum(RecurringStatus)
  status: RecurringStatus;

  @ApiPropertyOptional({ example: 'Vehicle sold' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
