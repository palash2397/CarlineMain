import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { DriverStatus } from 'src/common/enums/driver/status-enum';

export class UpdateDriverStatusDto {
  @ApiProperty({
    example: '68f0f8f0f8f0f8f0f8f0f8f0',
  })
  @IsNotEmpty({ message: 'Driver ID is required' })
  id: string;

  @ApiProperty({
    example: DriverStatus.ACTIVE,
    enum: [
      DriverStatus.ACTIVE,
      DriverStatus.INACTIVE,
      DriverStatus.ON_RIDE,
      DriverStatus.OFF_DUTY,
      DriverStatus.ON_CALL,
    ],
  })
  @IsNotEmpty({ message: 'Status is required' })
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase().trim() : value,
  )
  status: string;
}
