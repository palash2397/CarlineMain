import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

// Go online / Go offline button on the driver home screen.
export class DriverDutyDto {
  @ApiProperty({
    example: true,
    description: 'true = Go online (accept rides), false = Go offline',
  })
  @IsBoolean()
  isOnline: boolean;

  @ApiPropertyOptional({
    example: 37.7855,
    description: 'Current latitude of the driver when toggling duty',
  })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    example: -122.4040,
    description: 'Current longitude of the driver when toggling duty',
  })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}