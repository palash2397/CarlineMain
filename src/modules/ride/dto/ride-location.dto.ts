import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class RideLocationDto {
  @ApiPropertyOptional({
    example: '742 Evergreen Terrace, San Francisco, CA',
    description: 'Address text shown on the booking screen',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 37.7749, description: 'Latitude of the location' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: -122.4194, description: 'Longitude of the location' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}
