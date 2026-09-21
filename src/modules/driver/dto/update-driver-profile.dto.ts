import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateDriverProfileDto {
  @ApiPropertyOptional({ example: 'John Doe', description: 'Full name' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: '+1 555-0199', description: 'Phone number' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '05/20/1990', description: 'Date of birth' })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'Male', description: 'Gender' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: 'DL-982348', description: 'License number' })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'Commercial / Class A', description: 'License class' })
  @IsOptional()
  @IsString()
  licenseClass?: string;

  @ApiPropertyOptional({ example: '01/15/2020', description: 'License issue date' })
  @IsOptional()
  @IsString()
  issueDate?: string;

  @ApiPropertyOptional({ example: '01/15/2028', description: 'License expiry date' })
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiPropertyOptional({ example: 'Full Time Driver', description: 'Employment type' })
  @IsOptional()
  @IsString()
  employmentType?: string;

  @ApiPropertyOptional({ example: 'Downtown Metro', description: 'Preferred service area' })
  @IsOptional()
  @IsString()
  preferredServiceArea?: string;

  @ApiPropertyOptional({ example: '66e6c8e1e4b0c2a5d3f89555', description: 'Vehicle type ID' })
  @IsOptional()
  @IsString()
  vehicleTypeId?: string;

  @ApiPropertyOptional({ example: 'Sedan Comfort', description: 'Vehicle type' })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({ example: 'Petrol', description: 'Fuel type' })
  @IsOptional()
  @IsString()
  fuelType?: string;

  @ApiPropertyOptional({ example: 'Automatic', description: 'Transmission' })
  @IsOptional()
  @IsString()
  transmission?: string;

  @ApiPropertyOptional({ example: 'NY-TX-9982', description: 'Vehicle registration number' })
  @IsOptional()
  @IsString()
  vehicleRegistrationNumber?: string;

  @ApiPropertyOptional({ example: 'Toyota', description: 'Vehicle make' })
  @IsOptional()
  @IsString()
  make?: string;

  @ApiPropertyOptional({ example: 'Camry 2022', description: 'Model and year' })
  @IsOptional()
  @IsString()
  modelAndYear?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Profile avatar image' })
  @IsOptional()
  avatar?: any;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Government ID document/photo' })
  @IsOptional()
  governmentId?: any;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Driver license copy' })
  @IsOptional()
  licenseCopy?: any;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Vehicle registration document' })
  @IsOptional()
  vehicleRegistrationDoc?: any;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Insurance proof document' })
  @IsOptional()
  insuranceProof?: any;
}
