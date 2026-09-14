import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { UserRole } from 'src/common/enums/user/role.enum';
import { StatusEnum } from 'src/common/enums/general/status-enum';
import { Transform } from 'class-transformer';

export const AllowedCompanyUserRoles = [
  UserRole.DISPATCHER,
  UserRole.DRIVER_MANAGER,
  UserRole.CUSTOMER_SERVICE,
  UserRole.BILLING,
  UserRole.ACCOUNTANT,
  UserRole.MANAGER,
  UserRole.READ_ONLY,
  UserRole.REPORT_ONLY,
];

export class CreateCompanyUserDto {
  @ApiProperty({
    example: 'Rahul Mehta',
    description: 'Full name of the team member',
  })
  @IsNotEmpty({ message: 'Full name is required' })
  @IsString()
  fullName: string;

  @ApiProperty({
    example: 'rahul@example.com',
    description:
      'Email address of the team member (used for login & credentials)',
  })
  @IsNotEmpty({ message: 'Email address is required' })
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @ApiProperty({
    example: 'DISPATCHER',
    description: 'Role assigned to the team member',
    enum: AllowedCompanyUserRoles,
  })
  @IsNotEmpty({ message: 'Role is required' })
  @IsString()
  role: string;

  @ApiPropertyOptional({
    example: StatusEnum.ACTIVE,
    description: 'Account status (Active / Inactive)',
    enum: StatusEnum,
    default: StatusEnum.ACTIVE,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(StatusEnum, {
    message: 'Status must be Active or Inactive',
  })
  status?: string;

  @ApiPropertyOptional({
    example: '+91 9876543210',
    description: 'Optional phone number',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
