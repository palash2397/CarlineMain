import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateRatingDto {
  @ApiProperty({
    example: '66fb2475ab083c261e1b19a1',
    description: 'ID of the completed ride',
  })
  @IsMongoId()
  rideId: string;

  @ApiProperty({
    minimum: 1,
    maximum: 5,
    example: 5,
    description: 'Rating score from 1 to 5 stars',
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    required: false,
    example: 'Great driving and polite behavior!',
    description: 'Optional review comments',
  })
  @IsOptional()
  @IsString()
  review?: string;
}
