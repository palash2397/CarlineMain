import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class DriverCancelRideDto {
  @ApiProperty({ example: '6ab21f1f0fc5ffbd2fbe6401' })
  @IsMongoId()
  rideId: string;

  @ApiPropertyOptional({ example: 'Vehicle breakdown' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}