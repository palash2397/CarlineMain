import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class UpdateCustomerDto {
  @ApiProperty({
    example: '691aa8f81c36af5462c4551c',
    description: 'Customer ID',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  id: string;

  @ApiProperty({
    example: 'IVR Customer',
    description: 'Customer Full Name',
    required: false,
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({
    example: '+1919685434928@208.69.82.26',
    description: 'Customer Mobile Number / Caller ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  mobileNumber?: string;

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
    description: 'Account Number',
    required: false,
  })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiProperty({
    example: 'Inactive',
    description: 'Auto Email Notification (Active or Inactive)',
    required: false,
  })
  @IsOptional()
  @IsString()
  autoEmail?: string;

  @ApiProperty({
    example: 0,
    description: 'Customer Credit Balance',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  credit?: number;
}
