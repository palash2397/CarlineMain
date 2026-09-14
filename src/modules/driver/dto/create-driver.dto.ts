import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateDriverDto {
  // 1. Personal & Contact Information
  @ApiProperty({ example: 'John' })
  @IsNotEmpty({ message: 'First name is required' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsNotEmpty({ message: 'Last name is required' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'driver@company.com' })
  @IsNotEmpty({ message: 'Email address is required' })
  @IsEmail({}, { message: 'Invalid email address' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  email: string;

  @ApiProperty({ example: '+91 9999999999' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phoneNumber: string;

  // 2. Address & Emergency Contacts
  @ApiProperty({ example: '123 Main Street' })
  @IsNotEmpty({ message: 'Street address is required' })
  @IsString()
  streetAddress: string;

  @ApiProperty({ example: 'Indore' })
  @IsNotEmpty({ message: 'City is required' })
  @IsString()
  city: string;

  @ApiProperty({ example: '452001' })
  @IsNotEmpty({ message: 'ZIP Code is required' })
  @IsString()
  zipCode: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsNotEmpty({ message: 'Emergency contact name is required' })
  @IsString()
  emergencyContactName: string;

  @ApiProperty({ example: '+91 9888888888' })
  @IsNotEmpty({ message: 'Emergency phone is required' })
  @IsString()
  emergencyPhone: string;

  // 3. Driving License
  @ApiProperty({ example: 'DL-88220019' })
  @IsNotEmpty({ message: 'License number is required' })
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase().trim() : value,
  )
  licenseNumber: string;

  @ApiPropertyOptional({ example: 'Class A (Commercial)' })
  @IsOptional()
  @IsString()
  licenseClass?: string;

  @ApiProperty({ example: '2028-12-31' })
  @IsNotEmpty({ message: 'License expiry date is required' })
  @IsString()
  expiryDate: string;

  // 4. Vehicle Configuration
  @ApiPropertyOptional({ example: 'None (Unassigned)' })
  @IsOptional()
  @IsString()
  vehicleAssignment?: string;

  @ApiPropertyOptional({ example: 'Available' })
  @IsOptional()
  @IsString()
  defaultAvailability?: string;

  @ApiPropertyOptional({ example: 'Normal' })
  @IsOptional()
  @IsString()
  dispatchPriority?: string;

  @ApiPropertyOptional({
    example: ['Airport Trips Restricted', 'VIP Trips Restricted'],
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [value];
      } catch {
        return value.split(',').map((s) => s.trim());
      }
    }
    return Array.isArray(value) ? value : [];
  })
  restrictions?: string[];

  // 5. Working Schedule
  @ApiPropertyOptional({ example: '08:00 - 18:00' })
  @IsOptional()
  @IsString()
  monHours?: string;

  @ApiPropertyOptional({ example: '08:00 - 18:00' })
  @IsOptional()
  @IsString()
  tueHours?: string;

  @ApiPropertyOptional({ example: '08:00 - 18:00' })
  @IsOptional()
  @IsString()
  wedHours?: string;

  @ApiPropertyOptional({ example: '08:00 - 18:00' })
  @IsOptional()
  @IsString()
  thuHours?: string;

  @ApiPropertyOptional({ example: '08:00 - 18:00' })
  @IsOptional()
  @IsString()
  friHours?: string;

  @ApiPropertyOptional({ example: '08:00 - 18:00' })
  @IsOptional()
  @IsString()
  satHours?: string;

  @ApiPropertyOptional({ example: '08:00 - 18:00' })
  @IsOptional()
  @IsString()
  sunHours?: string;

  // 6. Payout Information
  @ApiPropertyOptional({ example: 'State Bank of India' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: '10098811772' })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'SBIN000109' })
  @IsOptional()
  @IsString()
  routingCode?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  status?: string;

  // Files handled via multipart: licenseCopy, insuranceProof
  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @IsOptional()
  licenseCopy?: any;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  @IsOptional()
  insuranceProof?: any;
}
