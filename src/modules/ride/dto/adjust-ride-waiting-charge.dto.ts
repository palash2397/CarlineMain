import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AdjustRideWaitingChargeDto {
  @ApiProperty({
    example: 2.5,
    description: 'Adjusted waiting charge amount (set 0 to waive)',
  })
  @IsNumber()
  @Min(0)
  waitingCharge: number;

  @ApiPropertyOptional({
    example: 8,
    description: 'Adjusted customer waiting minutes (optional)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  waitingMinutes?: number;

  @ApiPropertyOptional({
    example: 'Adjusted by driver manager due to flight delay',
    description: 'Reason for adjusting or waiving the waiting charge',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
