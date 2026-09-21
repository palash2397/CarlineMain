import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class UpdateVehicleTypeStatusDto {
  @ApiProperty({
    example: '66e6c8e1e4b0c2a5d3f89555',
    description: 'Vehicle type ID',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  id: string;

  @ApiProperty({
    example: 'Active',
    enum: ['Active', 'Inactive'],
    description: 'Status of the vehicle type',
    required: true,
  })
  @IsNotEmpty()
  @IsEnum(['Active', 'Inactive'])
  status: string;
}
