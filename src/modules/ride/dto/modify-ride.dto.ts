import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PaymentMethod } from 'src/common/enums/ride/payment-method.enum';
import { RideType } from 'src/common/enums/ride/ride-type.enum';
import { MAX_PASSENGERS } from 'src/constants';
import { RideLocationDto } from './ride-location.dto';

export class ModifyRideDto {
  @ApiPropertyOptional({
    type: RideLocationDto,
    example: {
      address: '742 Evergreen Terrace, San Francisco, CA',
      latitude: 37.7955,
      longitude: -122.3937,
    },
    description: 'Updated pickup location',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RideLocationDto)
  pickup?: RideLocationDto;

  @ApiPropertyOptional({
    type: RideLocationDto,
    example: {
      address: 'SFO Airport Terminal 2, San Francisco, CA',
      latitude: 37.6213,
      longitude: -122.379,
    },
    description: 'Updated dropoff destination',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RideLocationDto)
  dropoff?: RideLocationDto;

  @ApiPropertyOptional({
    example: '6ab0f9c00fc5ffbd2fbe62df',
    description: 'Updated vehicle type ID',
  })
  @IsOptional()
  @IsString()
  vehicleTypeId?: string;

  @ApiPropertyOptional({
    enum: RideType,
    description: 'Updated ride type (INSTANT or SCHEDULED)',
  })
  @IsOptional()
  @IsEnum(RideType)
  rideType?: RideType;

  @ApiPropertyOptional({
    example: '2026-10-05T14:30:00.000Z',
    description: 'Updated pickup date & time for scheduled rides',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledAt?: Date;

  @ApiPropertyOptional({
    example: 3,
    minimum: 1,
    maximum: MAX_PASSENGERS,
    description: 'Updated passenger count',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PASSENGERS)
  passengerCount?: number;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    description: 'Updated payment method',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    example: 'Updated pickup details or notes',
    description: 'Updated driver notes',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @ApiPropertyOptional({
    example: '670f9c00fc5ffbd2fbe62df1',
    description: 'Re-assign or assign driver (for dispatcher / admin use)',
  })
  @IsOptional()
  @IsString()
  driverId?: string;
}
