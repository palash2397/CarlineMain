import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Match } from '../../../common/decorators/match.decorator';

export class ResetPasswordDto {
  @ApiPropertyOptional()
  @IsString()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(20, { message: 'Password must be at most 20 characters long' })
  password: string;

  @ApiPropertyOptional()
  @IsString()
  @Match('password', { message: 'Passwords do not match' })
  confirmPassword: string;
}
