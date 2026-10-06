import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignDriverDto {
  @ApiProperty({
    description: 'Driver MongoDB ID to assign to the trip',
    example: '6aa92a42b1292dd692c81869',
  })
  @IsNotEmpty()
  @IsString()
  driverId: string;
}

export class CancelTripDto {
  @ApiPropertyOptional({
    description: 'Reason for cancellation by dispatcher',
    example: 'Customer requested cancellation',
  })
  @IsOptional()
  @IsString()
  cancelReason?: string;
}
