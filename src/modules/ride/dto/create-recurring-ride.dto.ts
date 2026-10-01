import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDate,
  IsDefined,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PaymentMethod } from 'src/common/enums/ride/payment-method.enum';
import { RecurrenceFrequency } from 'src/common/enums/ride/recurrence-frequency.enum';
import { MAX_PASSENGERS } from 'src/constants';

import { RideLocationDto } from './ride-location.dto';

// A recurring booking repeats the same ride on the selected days and time
// (weekly weekdays or monthly days of the month) until the passenger pauses
// or cancels the series.
export class CreateRecurringRideDto {
  @ApiProperty({
    type: RideLocationDto,
    example: {
      address: '742 Evergreen Terrace, San Francisco, CA',
      latitude: 37.7955,
      longitude: -122.3937,
    },
    description: 'Pickup location of every ride of the series',
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
    description: 'Dropoff location of every ride of the series',
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => RideLocationDto)
  dropoff: RideLocationDto;

  @ApiProperty({
    example: '6ab0f9c00fc5ffbd2fbe62df',
    description: 'Vehicle type (class) of every ride of the series',
  })
  @IsString()
  vehicleTypeId: string;

  @ApiPropertyOptional({
    enum: RecurrenceFrequency,
    default: RecurrenceFrequency.WEEKLY,
    description:
      'WEEKLY repeats on daysOfWeek (every week), MONTHLY repeats on daysOfMonth (every month)',
  })
  @IsOptional()
  @IsEnum(RecurrenceFrequency)
  frequency?: RecurrenceFrequency;

  @ApiPropertyOptional({
    example: [1, 2, 3, 4, 5],
    type: [Number],
    description:
      'WEEKLY only: repeat days, 0 = Sunday ... 6 = Saturday (Mon-Fri is 1-5)',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @ApiPropertyOptional({
    example: [5],
    type: [Number],
    description:
      'MONTHLY only: days of the month, 1 - 31. One day is a fixed date (5 = the 5th of every month), several days are custom dates (5, 15, 25 = these days of every month)',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(31, { each: true })
  daysOfMonth?: number[];

  @ApiProperty({
    example: '09:30',
    description: 'Pickup time of the day in 24 hour HH:mm format',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'pickupTime must be in HH:mm 24 hour format',
  })
  pickupTime: string;

  @ApiProperty({
    example: '2026-10-01',
    description:
      'First day the series may run (pickup time is added by the backend)',
  })
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Last day of the series, keep empty for an open ended series',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @ApiPropertyOptional({
    example: 2,
    minimum: 1,
    maximum: MAX_PASSENGERS,
    description: 'Number of riders of every ride, default 1',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PASSENGERS)
  passengerCount?: number;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    default: PaymentMethod.CASH,
    description: 'Payment method of every ride',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    example: 'Office drop, wait at gate',
    description: 'Driver note of every ride',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @ApiPropertyOptional({
    example: 'CARLINE10',
    description: 'Promo code applied on every ride of the series',
  })
  @IsOptional()
  @IsString()
  promoCode?: string;
}
