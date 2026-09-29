import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDate,
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

// Every field is optional, only the sent ones are changed on the series.
export class UpdateRecurringRideDto {
  @ApiPropertyOptional({ type: RideLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RideLocationDto)
  pickup?: RideLocationDto;

  @ApiPropertyOptional({ type: RideLocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RideLocationDto)
  dropoff?: RideLocationDto;

  @ApiPropertyOptional({ example: '6ab0f9c00fc5ffbd2fbe62df' })
  @IsOptional()
  @IsString()
  vehicleTypeId?: string;

  @ApiPropertyOptional({
    enum: RecurrenceFrequency,
    description:
      'Switch the series between WEEKLY (daysOfWeek) and MONTHLY (daysOfMonth)',
  })
  @IsOptional()
  @IsEnum(RecurrenceFrequency)
  frequency?: RecurrenceFrequency;

  @ApiPropertyOptional({
    example: [5, 15, 25],
    type: [Number],
    description:
      'MONTHLY only: days of the month, 1 - 31 (one day = fixed date, several days = custom dates)',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(31, { each: true })
  daysOfMonth?: number[];

  @ApiPropertyOptional({
    example: [1, 2, 3, 4, 5],
    type: [Number],
    description: 'WEEKLY only: repeat days, 0 = Sunday ... 6 = Saturday',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @ApiPropertyOptional({ example: '09:30' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'pickupTime must be in HH:mm 24 hour format',
  })
  pickupTime?: string;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Send null to make the series open ended again',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date | null;

  @ApiPropertyOptional({ example: 2, minimum: 1, maximum: MAX_PASSENGERS })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PASSENGERS)
  passengerCount?: number;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: 'Office drop, wait at gate' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @ApiPropertyOptional({ example: 'CARLINE10' })
  @IsOptional()
  @IsString()
  promoCode?: string;
}
