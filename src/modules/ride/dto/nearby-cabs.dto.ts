import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class NearbyCabsDto {
  @ApiProperty({ example: 37.7749, description: 'Latitude to search around' })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: -122.4194, description: 'Longitude to search around' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiPropertyOptional({
    example: '6ab0f9c00fc5ffbd2fbe62df',
    description: 'Optional vehicle type filter',
  })
  @IsOptional()
  @IsString()
  vehicleTypeId?: string;
}
