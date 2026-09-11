import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AuthService } from './auth.service';

import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { LoginUserDto } from './dto/login-user.dto';

import { UserRegisterDto } from './dto/user-register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/register')
  userRegister(@Body() dto: UserRegisterDto) {
    return this.authService.userRegister(dto);
  }

  @Post('/verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('/resend-otp')
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Post('/login')
  login(@Body() dto: LoginUserDto) {
    return this.authService.login(dto);
  }

  // @Post('/sendOtp')
  // sendOtp(@Body() dto: SendOtpDto) {
  //   return this.authService.sendOtp(dto);
  // }

  // @Post('/verifyOtp')
  // verifyOtp(@Body() dto: VerifyOtpDto) {
  //   return this.authService.verifyOtp(dto);
  // }

  // @Post('/resendOtp')
  // resendOtp(@Body() dto: ResendOtpDto) {
  //   return this.authService.resendOtp(dto);
  // }
}
