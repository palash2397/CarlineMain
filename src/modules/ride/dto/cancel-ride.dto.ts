import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelRideDto {
  @ApiProperty({ example: '6ab21f1f0fc5ffbd2fbe6401' })
  @IsString()
  rideId: string;

  @ApiPropertyOptional({ example: 'Plans changed' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
