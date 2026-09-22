import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { AddressType } from 'src/common/enums/user/address.enum';

export class CreateAddressDto {
  @ApiProperty({
    example: 'Home',
    description: 'Name the passenger gives this place',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @IsString()
  @MaxLength(60)
  label: string;

  @ApiProperty({
    example: '742 Evergreen Terrace, San Francisco, CA',
    description: 'Full street address',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  address: string;

  @ApiProperty({
    enum: AddressType,
    example: AddressType.HOME,
    description: 'Icon category shown on the saved place card',
  })
  @IsEnum(AddressType)
  type: AddressType;

  @ApiPropertyOptional({
    example: 37.7749,
    description: 'Pickup latitude used by the Book Ride to Here button',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    example: -122.4194,
    description: 'Pickup longitude used by the Book Ride to Here button',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
