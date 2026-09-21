import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResendOtpDto {
  @ApiProperty({
    example: 'johndoe@yopmail.com',
  })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    example: 'verify',
    description: 'Type of OTP: "verify" or "password"',
  })
  @IsOptional()
  @IsString()
  type?: string;
}
