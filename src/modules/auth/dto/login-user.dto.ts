import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginUserDto {
  @ApiProperty({ example: 'superadmin@yopmail.com' })
  @IsNotEmpty()
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @ApiProperty({ example: 'superadmin' })
  @IsNotEmpty()
  @MinLength(6, {
    message: 'Password must be at least 6 characters long',
  })
  password: string;

  @ApiProperty({
    example: 'SUPERADMIN',
    required: false,
    description: 'Portal role selection (e.g. SUPERADMIN, COMPANY_ADMIN, DISPATCHER)',
  })
  @IsOptional()
  @IsString()
  role?: string;
}
