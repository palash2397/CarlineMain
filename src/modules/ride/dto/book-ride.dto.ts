import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsDefined,
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
import { MAX_PASSENGERS } from '../ride.constants';
import { RideLocationDto } from './ride-location.dto';

export class BookRideDto {
  @ApiProperty({
    type: RideLocationDto,
    example: {
      address: '742 Evergreen Terrace, San Francisco, CA',
      latitude: 37.7955,
      longitude: -122.3937,
    },
    description: 'Pickup location selected by the passenger',
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => RideLocationDto)
  pickup: RideLocationDto;

  @ApiProperty({
    type: RideLocationDto,
    example: {
      address: 'SFO Airport Terminal 2, San Francisco, CA',
      latitude: 37.6213,
      longitude: -122.379,
    },
    description: 'Dropoff location selected by the passenger',
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => RideLocationDto)
  dropoff: RideLocationDto;

  @ApiProperty({
    example: '6ab0f9c00fc5ffbd2fbe62df',
    description: 'Vehicle type (class) selected on the booking screen',
  })
  @IsString()
  vehicleTypeId: string;

  @ApiPropertyOptional({
    example: 2,
    minimum: 1,
    maximum: MAX_PASSENGERS,
    description: 'Number of riders, default 1',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PASSENGERS)
  passengerCount?: number;

  @ApiPropertyOptional({
    enum: RideType,
    default: RideType.INSTANT,
    description: 'INSTANT ride or a SCHEDULED ride',
  })
  @IsOptional()
  @IsEnum(RideType)
  rideType?: RideType;

  @ApiPropertyOptional({
    example: '2026-09-22T09:30:00.000Z',
    description: 'Required (future date) when rideType is SCHEDULED',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledAt?: Date;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    default: PaymentMethod.CASH,
    description: 'Payment method selected by the passenger',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    example: 'e.g. 2 bags, wait at gate',
    description: 'Driver note',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @ApiPropertyOptional({
    example: 'CARLINE10',
    description: 'Optional promo code applied on the fare',
  })
  @IsOptional()
  @IsString()
  promoCode?: string;
}
