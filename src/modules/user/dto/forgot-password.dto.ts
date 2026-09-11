import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiPropertyOptional()
  @IsString()
  email: string;
}
