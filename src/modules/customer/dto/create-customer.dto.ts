import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCustomerDto {
  @ApiProperty({
    example: 'IVR Customer',
    description: 'Customer Full Name',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({
    example: '+1919685434928@208.69.82.26',
    description: 'Customer Mobile Number / Caller ID',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  mobileNumber: string;

  @ApiProperty({
    example: 'customer@example.com',
    description: 'Customer Email Address',
    required: false,
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({
    example: '123 Main St, Raleigh, NC',
    description: 'Customer Address',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    example: '123 Main St, Raleigh, NC',
    description: 'Customer Full Address alias',
    required: false,
  })
  @IsOptional()
  @IsString()
  fullAddress?: string;

  @ApiProperty({
    example: '+1919685434928@208.69.82.26',
    description: 'Account Number (defaults to mobile number)',
    required: false,
  })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiProperty({
    example: 'Inactive',
    description: 'Auto Email Notification (Active or Inactive)',
    required: false,
    default: 'Inactive',
  })
  @IsOptional()
  @IsString()
  autoEmail?: string;

  @ApiProperty({
    example: 0,
    description: 'Customer Credit Balance',
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  credit?: number;
}
