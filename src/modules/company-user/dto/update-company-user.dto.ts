import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { AllowedCompanyUserRoles } from './create-company-user.dto';
import { StatusEnum } from 'src/common/enums/general/status-enum';

export class UpdateCompanyUserDto {
  @ApiPropertyOptional({
    example: '6918698f1c6d5f7e3c9d9d9d',
    description: 'Id of the team member',
  })
  @IsString()
  id: string;

  @ApiPropertyOptional({
    example: 'Rahul Mehta',
    description: 'Full name of the team member',
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({
    example: 'rahul@example.com',
    description: 'Email address of the team member',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  @ApiPropertyOptional({
    example: 'DISPATCHER',
    description: 'Role assigned to the team member',
    enum: AllowedCompanyUserRoles,
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    example: 'Active',
    description: 'Account status (Active / Inactive)',
    enum: [StatusEnum.ACTIVE, StatusEnum.INACTIVE],
  })
  @IsOptional()
  @IsEnum(StatusEnum)
  status?: StatusEnum;

  @ApiPropertyOptional({
    example: '+91 9876543210',
    description: 'Optional phone number',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
