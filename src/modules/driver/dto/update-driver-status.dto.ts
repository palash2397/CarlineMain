import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { DriverStatus } from 'src/common/enums/driver/status-enum';

export class UpdateDriverStatusDto {
  @ApiPropertyOptional({
    example: '65f123456789abcdef012345',
    description: 'Driver ID (optional if provided in route URL path)',
  })
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiProperty({
    example: DriverStatus.ACTIVE,
    description:
      'Target driver status (ACTIVE to approve, REJECTED to reject)',
    enum: DriverStatus,
  })
  @IsNotEmpty({ message: 'Status is required' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase().trim() : value,
  )
  @IsEnum(DriverStatus, {
    message: 'Status must be a valid DriverStatus (e.g. ACTIVE or REJECTED)',
  })
  status: DriverStatus;

  @ApiPropertyOptional({
    example: 'Driver license copy is expired or illegible',
    description: 'Reason for rejection (applicable when status is REJECTED)',
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
