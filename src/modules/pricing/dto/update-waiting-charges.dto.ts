import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateWaitingChargesDto {
  @ApiProperty({
    example: 5,
    description: 'Grace Period before waiting starts (Minutes)',
    required: true,
  })
  @IsNumber()
  @Min(0)
  gracePeriodMinutes: number;

  @ApiProperty({
    example: 0.3,
    description: 'Waiting Charge Per Minute ($)',
    required: true,
  })
  @IsNumber()
  @Min(0)
  waitingChargePerMinute: number;

  @ApiPropertyOptional({
    example: '66e6be12e4b0c2a5d3f88999',
    description: 'Company ID (optional, SuperAdmin can specify)',
  })
  @IsOptional()
  companyId?: string;
}
