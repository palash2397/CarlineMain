import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateDriverVehicleTypeDto {
  @ApiProperty({
    description: 'Driver MongoDB ID',
    example: '66e6be12e4b0c2a5d3f88123',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  driverId: string;

  @ApiProperty({
    description:
      'Vehicle Type ID (or Name) from SuperAdmin vehicle classes list',
    example: '6ab0f383f9ae9e0b487bb967',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  vehicleType: string;
}
