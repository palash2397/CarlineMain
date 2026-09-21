import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class RegisterDriverDto {
  // ==========================================
  // Step 1: Personal Information
  // ==========================================
  @ApiProperty({
    example: 'John Doe',
    description: 'Full name of the driver',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({
    example: '05/20/1990',
    description: 'Date of birth (e.g. mm/dd/yyyy)',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  dateOfBirth: string;

  @ApiProperty({
    example: 'Male',
    description: 'Gender (e.g. Male, Female, Other)',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  gender: string;

  @ApiProperty({
    example: '+1 555-0199',
    description: 'Driver phone number',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @ApiProperty({
    example: 'johndoe@example.com',
    description: 'Driver email address',
    required: true,
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    example: 'CMP-001',
    description: 'Company ID selected by the driver',
    required: false,
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  // ==========================================
  // Step 2: Driving Credentials & Service Area
  // ==========================================
  @ApiProperty({
    example: 'DL-982348',
    description: 'Driver License Number',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  licenseNumber: string;

  @ApiPropertyOptional({
    example: 'Commercial / Class A',
    description: 'License Class',
    required: false,
  })
  @IsOptional()
  @IsString()
  licenseClass?: string;

  @ApiPropertyOptional({
    example: '01/15/2020',
    description: 'License Issue Date (e.g. mm/dd/yyyy)',
    required: false,
  })
  @IsOptional()
  @IsString()
  issueDate?: string;

  @ApiProperty({
    example: '01/15/2028',
    description: 'License Expiry Date (e.g. mm/dd/yyyy)',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  expiryDate: string;

  @ApiPropertyOptional({
    example: 'Full Time Driver',
    description: 'Employment Type',
    required: false,
  })
  @IsOptional()
  @IsString()
  employmentType?: string;

  @ApiPropertyOptional({
    example: 'Downtown Metro',
    description: 'Preferred Service Area or City',
    required: false,
  })
  @IsOptional()
  @IsString()
  preferredServiceArea?: string;

  // ==========================================
  // Step 3: Vehicle Specifications
  // ==========================================
  @ApiPropertyOptional({
    example: '66e6c8e1e4b0c2a5d3f89555',
    description: 'Vehicle Type ID (selected from SuperAdmin vehicle classes list)',
    required: false,
  })
  @IsOptional()
  @IsString()
  vehicleTypeId?: string;

  @ApiPropertyOptional({
    example: 'Sedan Comfort',
    description: 'Vehicle Type / Class Name (e.g. Sedan Comfort, SUV 6-Seater, Eco EV Green, VIP Executive)',
    required: false,
  })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({
    example: 'Petrol',
    description: 'Fuel Type',
    required: false,
  })
  @IsOptional()
  @IsString()
  fuelType?: string;

  @ApiPropertyOptional({
    example: 'Automatic',
    description: 'Transmission',
    required: false,
  })
  @IsOptional()
  @IsString()
  transmission?: string;

  @ApiProperty({
    example: 'TX-992-B',
    description: 'Vehicle Registration Number',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  vehicleRegistrationNumber: string;

  @ApiPropertyOptional({
    example: 'Toyota',
    description: 'Vehicle Make (Brand)',
    required: false,
  })
  @IsOptional()
  @IsString()
  make?: string;

  @ApiPropertyOptional({
    example: 'Camry 2024',
    description: 'Vehicle Model & Year',
    required: false,
  })
  @IsOptional()
  @IsString()
  modelAndYear?: string;

  // ==========================================
  // Step 4: Document Uploads & URLs
  // ==========================================
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'Government Issued ID (National ID / Passport) PDF, JPG or PNG (Max 10MB)',
  })
  @IsOptional()
  governmentId?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'Commercial Driving License Copy PDF, JPG or PNG (Max 10MB)',
  })
  @IsOptional()
  licenseCopy?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'Vehicle Registration Document PDF, JPG or PNG (Max 10MB)',
  })
  @IsOptional()
  vehicleRegistrationDoc?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description:
      'Vehicle Insurance Certificate PDF, JPG or PNG (Max 10MB)',
  })
  @IsOptional()
  insuranceProof?: any;

  @ApiProperty({
    example: true,
    description: 'Certification and acceptance of terms & privacy policy',
    required: true,
  })
  @Transform(({ value }) => value === true || value === 'true' || value === 1 || value === '1')
  @IsNotEmpty()
  @IsBoolean()
  termsAccepted: boolean;
}
