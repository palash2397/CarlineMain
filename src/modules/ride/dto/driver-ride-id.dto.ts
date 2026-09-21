import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class DriverRideIdDto {
  @ApiProperty({
    example: '6ab21f1f0fc5ffbd2fbe6401',
    description: 'Ride id from the request card',
  })
  @IsMongoId()
  rideId: string;
}