import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateDispatcherBookingDto {
  @ApiPropertyOptional({ description: 'Existing customer ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Alias for userId (from frontend form)' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Guest full name' })
  @IsOptional()
  @IsString()
  guestName?: string;

  @ApiPropertyOptional({ description: 'Guest passenger first name' })
  @IsOptional()
  @IsString()
  passengerFirstName?: string;

  @ApiPropertyOptional({ description: 'Guest passenger last name' })
  @IsOptional()
  @IsString()
  passengerLastName?: string;

  @ApiPropertyOptional({ description: 'Guest phone number' })
  @IsOptional()
  @IsString()
  guestPhone?: string;

  @ApiPropertyOptional({ description: 'Guest passenger phone number' })
  @IsOptional()
  @IsString()
  passengerPhone?: string;

  @ApiPropertyOptional({ description: 'Guest passenger email' })
  @IsOptional()
  @IsString()
  passengerEmail?: string;

  @ApiPropertyOptional({ description: 'Pickup location (object or string address)' })
  @IsOptional()
  pickup?: any;

  @ApiPropertyOptional({ description: 'Dropoff destination (object or string address)' })
  @IsOptional()
  dropoff?: any;

  @ApiPropertyOptional({ description: 'Destination address string (from frontend form)' })
  @IsOptional()
  dest?: any;

  @ApiPropertyOptional({ description: 'Customer type: existing or guest' })
  @IsOptional()
  customerType?: string;

  @ApiPropertyOptional({ description: 'Vehicle type ID or vehicle name string' })
  @IsOptional()
  vehicleTypeId?: string;

  @ApiPropertyOptional({ description: 'Vehicle name string (from frontend form)' })
  @IsOptional()
  vehicle?: string;

  @ApiPropertyOptional({ description: 'Vehicle type name string (from frontend form)' })
  @IsOptional()
  vehicleTypeName?: string;

  @ApiPropertyOptional({ description: 'Passenger count' })
  @IsOptional()
  passengerCount?: any;

  @ApiPropertyOptional({ description: 'Passengers count (from frontend form)' })
  @IsOptional()
  passengers?: any;

  @ApiPropertyOptional({ description: 'Ride type (INSTANT or SCHEDULED)' })
  @IsOptional()
  rideType?: any;

  @ApiPropertyOptional({ description: 'Scheduled pickup date' })
  @IsOptional()
  scheduledAt?: any;

  @ApiPropertyOptional({ description: 'Scheduled date string (YYYY-MM-DD)' })
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ description: 'Scheduled time string (e.g. 12:00 PM)' })
  @IsOptional()
  time?: string;

  @ApiPropertyOptional({ description: 'Payment method string' })
  @IsOptional()
  paymentMethod?: any;

  @ApiPropertyOptional({ description: 'Notes or additional stops' })
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Additional stops string (from frontend form)' })
  @IsOptional()
  stops?: string;

  @ApiPropertyOptional({ description: 'Dispatch mode: Auto or Manual' })
  @IsOptional()
  dispatchMode?: string;

  @ApiPropertyOptional({ description: 'Optional promo code' })
  @IsOptional()
  promoCode?: string;

  @ApiPropertyOptional({ description: 'Optional driver ID to assign directly' })
  @IsOptional()
  driverId?: string;

  @ApiPropertyOptional({ description: 'Optional company ID' })
  @IsOptional()
  companyId?: string;
}
