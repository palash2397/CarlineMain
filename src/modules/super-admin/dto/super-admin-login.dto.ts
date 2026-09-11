import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SuperAdminLoginDto {
  @ApiProperty({
    example: 'superadmin@yopmail.com',
    description: 'Super Admin Email Address',
    required: true,
  })
  @IsNotEmpty()
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @ApiProperty({
    example: 'superadmin',
    description: 'Super Admin Password',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6, {
    message: 'Password must be at least 6 characters long',
  })
  password: string;
}
