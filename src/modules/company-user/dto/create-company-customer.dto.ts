import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCompanyCustomerDto {
  @ApiProperty({ description: 'Customer first name' })
  @IsNotEmpty({ message: 'First name is required' })
  @IsString()
  firstName: string;

  @ApiPropertyOptional({ description: 'Customer last name' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Customer full name (alias)' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ description: 'Customer phone number' })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString()
  phoneNumber: string;

  @ApiPropertyOptional({ description: 'Customer email address' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Target company ID' })
  @IsOptional()
  @IsString()
  companyId?: string;
}
