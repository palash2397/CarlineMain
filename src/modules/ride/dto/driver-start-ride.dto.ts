import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString, Length } from 'class-validator';

export class DriverStartRideDto {
  @ApiProperty({ example: '6ab21f1f0fc5ffbd2fbe6401' })
  @IsMongoId()
  rideId: string;

  @ApiPropertyOptional({
    example: '4821',
    description:
      'Passenger pickup OTP. Optional - when sent it must match the booking OTP.',
  })
  @IsOptional()
  @IsString()
  @Length(4, 6)
  otp?: string;
}