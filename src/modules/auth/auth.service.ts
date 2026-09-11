import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

import { ApiResponse } from 'src/helpers/ApiResponse';
import { generateOtp, getExpirationTime } from 'src/helpers/index';
import { Msg } from 'src/helpers/responseMsg';

import { User, UserDocument } from 'src/modules/user/schema/user.schema';
import { UserRegisterDto } from './dto/user-register.dto';
import { UserRole } from 'src/common/enums/user/role.enum';

import { getOtpEmailTemplate } from 'src/modules/mail/template/otp.template';
import { MailService } from 'src/modules/mail/mail.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { LoginUserDto } from './dto/login-user.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly mailService: MailService,
  ) {}

  async userRegister(dto: UserRegisterDto) {
    try {
      const { firstName, lastName, phoneNumber, email, password } = dto;

      const existingUser = await this.userModel.findOne({
        $or: [{ email }, { phoneNumber }],
      });
      if (existingUser) {
        if (existingUser.email === dto.email) {
          return new ApiResponse(400, {}, Msg.USER_EXISTS_EMAIL);
        } else if (existingUser.phoneNumber === dto.phoneNumber) {
          return new ApiResponse(400, {}, Msg.USER_EXISTS_PHONE);
        }
      }

      const otp = generateOtp();
      const otpExpiry = getExpirationTime();

      const newUser = await this.userModel.create({
        firstName,
        lastName,
        phoneNumber,
        email,
        password,
        otp,
        otpExpireAt: otpExpiry,
      });

      await this.mailService.sendEmail(
        dto.email,
        'OTP Verification',
        `Your OTP is ${otp}`,
        getOtpEmailTemplate(otp, dto.firstName),
      );

      return new ApiResponse(
        200,
        {
          _id: newUser._id,
        },
        Msg.OTP_SENT,
      );
    } catch (error) {
      console.log('error while user registration', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async verifyOtp(dto: VerifyOtpDto) {
    try {
      const checkUser = await this.userModel.findOne({ email: dto.email });
      if (!checkUser) {
        return new ApiResponse(400, {}, Msg.USER_NOT_FOUND);
      }

      if (checkUser.isVerified) {
        return new ApiResponse(400, {}, Msg.USER_ALREADY_VERIFIED);
      }

      if (!checkUser.otp || !checkUser.otpExpireAt) {
        return new ApiResponse(400, {}, Msg.OTP_INVALID);
      }

      if (checkUser.otp !== dto.otp || new Date() > checkUser.otpExpireAt) {
        return new ApiResponse(400, {}, Msg.OTP_INVALID);
      }

      if (dto.type === 'password') {
        checkUser.isPasswordReset = true;
        checkUser.otp = undefined;
        checkUser.otpExpireAt = undefined;

        await checkUser.save();

        return new ApiResponse(200, {}, Msg.OTP_VERIFIED);
      }

      checkUser.isVerified = true;
      checkUser.otp = undefined;
      checkUser.otpExpireAt = undefined;

      await checkUser.save();

      return new ApiResponse(200, {}, Msg.OTP_VERIFIED);
    } catch (error) {
      console.log(`error while verifying the otp`, error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async resendOtp(dto: ResendOtpDto) {
    try {
      const checkUser = await this.userModel.findOne({ email: dto.email });
      if (!checkUser) {
        return new ApiResponse(400, {}, Msg.USER_NOT_FOUND);
      }

      if (checkUser.isVerified) {
        return new ApiResponse(400, {}, Msg.USER_ALREADY_VERIFIED);
      }

      const otp = generateOtp();
      const otpExpiresAt = getExpirationTime();

      console.log('otp', otp);
      console.log('otpExpiresAt', otpExpiresAt);

      checkUser.otp = otp;
      checkUser.otpExpireAt = otpExpiresAt;

      await checkUser.save();

      await this.mailService.sendEmail(
        dto.email,
        'OTP Verification',
        `Your OTP is ${otp}`,
        getOtpEmailTemplate(otp, checkUser.firstName),
      );

      return new ApiResponse(200, {}, Msg.OTP_RESENT);
    } catch (error) {
      console.log(`error while resending the otp`, error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async login(dto: LoginUserDto) {
    try {
      const normalizedEmail = (dto.email || '').toLowerCase().trim();
      const userData = await this.userModel
        .findOne({ email: normalizedEmail })
        .select('+password');
      if (!userData) {
        return new ApiResponse(400, {}, Msg.INVALID_CREDENTIALS);
      }

      if (!userData.isActive) {
        return new ApiResponse(400, {}, Msg.ACCOUNT_DEACTIVATED);
      }

      if (!userData.isVerified) {
        return new ApiResponse(400, {}, Msg.USER_NOT_VERIFIED);
      }

      if (dto.role) {
        const requestedRole = dto.role.toUpperCase().replace(/\s+/g, '_');
        const userRole = (userData.role || '').toUpperCase();
        if (requestedRole !== userRole && userRole !== UserRole.SUPERADMIN) {
          return new ApiResponse(
            403,
            {},
            `Unauthorized: You do not have permission to access the ${dto.role} portal.`,
          );
        }
      }

      const isPasswordValid = await bcrypt.compare(
        dto.password,
        userData?.password!,
      );
      if (!isPasswordValid) {
        return new ApiResponse(401, {}, Msg.INVALID_CREDENTIALS);
      }

      const token = jwt.sign(
        { id: userData._id, roles: userData.role, email: userData.email },
        process.env.JWT_SECRET!,
        {
          expiresIn: '10d',
        },
      );

      const userDataResponse = {
        _id: userData._id,
        firstName: userData.firstName,
        lastName: userData.lastName,
        name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        role: userData.role,
        roles: userData.role,
        token,
      };

      return new ApiResponse(200, userDataResponse, Msg.LOGIN_SUCCESS);
    } catch (error) {
      console.log(`error while logging in`, error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }
}
