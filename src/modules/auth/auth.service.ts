import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

import { ApiResponse } from 'src/helpers/ApiResponse';
import { generateOtp, getExpirationTime } from 'src/helpers/index';
import { Msg } from 'src/helpers/responseMsg';

import { User, UserDocument } from 'src/modules/user/schema/user.schema';
import {
  CompanyUser,
  CompanyUserDocument,
} from '../company-user/schema/company-user.schema';
import {
  Company,
  CompanyDocument,
} from '../super-admin/schema/company.schema';
import {
  Driver,
  DriverDocument,
} from '../driver/schema/driver.schema';
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
    @InjectModel(CompanyUser.name)
    private readonly companyUserModel: Model<CompanyUserDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
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
      const normalizedEmail = (dto.email || '').toLowerCase().trim();
      let checkUser: any = await this.userModel.findOne({
        email: normalizedEmail,
      });
      if (!checkUser) {
        checkUser = await this.companyUserModel.findOne({
          email: normalizedEmail,
        });
      }
      if (!checkUser) {
        checkUser = await this.companyModel.findOne({
          'primaryContact.email': normalizedEmail,
        });
      }
      if (!checkUser) {
        checkUser = await this.driverModel.findOne({
          email: normalizedEmail,
        });
      }
      if (!checkUser) {
        return new ApiResponse(400, {}, Msg.USER_NOT_FOUND);
      }

      console.log(dto.type);

      if (dto.type == 'verify') {
        if (checkUser.isVerified) {
          return new ApiResponse(400, {}, Msg.USER_ALREADY_VERIFIED);
        }
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
      const normalizedEmail = (dto.email || '').toLowerCase().trim();
      let checkUser: any = await this.userModel.findOne({ email: normalizedEmail });
      if (!checkUser) {
        checkUser = await this.companyUserModel.findOne({ email: normalizedEmail });
      }
      if (!checkUser) {
        checkUser = await this.companyModel.findOne({
          'primaryContact.email': normalizedEmail,
        });
      }
      if (!checkUser) {
        checkUser = await this.driverModel.findOne({
          email: normalizedEmail,
        });
      }
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

      const recipientName =
        checkUser.firstName ||
        (checkUser.fullName ? checkUser.fullName.split(' ')[0] : null) ||
        (checkUser.primaryContact ? checkUser.primaryContact.name : 'User');

      await this.mailService.sendEmail(
        normalizedEmail,
        'OTP Verification',
        `Your OTP is ${otp}`,
        getOtpEmailTemplate(otp, recipientName),
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
      let isCompanyAccount = false;
      let userData: any = await this.userModel
        .findOne({ email: normalizedEmail })
        .select('+password');

      if (!userData) {
        userData = await this.companyUserModel
          .findOne({ email: normalizedEmail })
          .select('+password');
      }

      if (!userData) {
        userData = await this.companyModel
          .findOne({ 'primaryContact.email': normalizedEmail })
          .select('+password');
        if (userData) {
          isCompanyAccount = true;
        }
      }

      let isDriverAccount = false;
      if (!userData) {
        userData = await this.driverModel
          .findOne({ email: normalizedEmail })
          .select('+password');
        if (userData) {
          isDriverAccount = true;
        }
      }

      if (!userData) {
        return new ApiResponse(400, {}, Msg.INVALID_CREDENTIALS);
      }

      const isAccountActive = isCompanyAccount
        ? userData.isActive !== false &&
          userData.status !== 'Inactive' &&
          userData.status !== 'Suspended'
        : isDriverAccount
        ? userData.isActive !== false && userData.status !== 'INACTIVE'
        : userData.isActive;

      if (!isAccountActive) {
        return new ApiResponse(400, {}, Msg.ACCOUNT_DEACTIVATED);
      }

      if (userData.isVerified === false) {
        return new ApiResponse(400, {}, Msg.USER_NOT_VERIFIED);
      }

      const userRole = (
        userData.role ||
        (isCompanyAccount
          ? UserRole.COMPANY_ADMIN
          : isDriverAccount
          ? UserRole.DRIVER
          : '')
      ).toUpperCase();

      if (dto.role) {
        let requestedRole = dto.role.toUpperCase().replace(/\s+/g, '_');
        let currentRole = userRole;

        // Normalize Accounting / Accountant equivalence
        if (requestedRole === 'ACCOUNTING') requestedRole = 'ACCOUNTANT';
        if (currentRole === 'ACCOUNTING') currentRole = 'ACCOUNTANT';

        if (requestedRole !== currentRole && currentRole !== UserRole.SUPERADMIN) {
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

      const email = isCompanyAccount
        ? userData.primaryContact.email
        : userData.email;
      const companyId = isCompanyAccount
        ? userData._id.toString()
        : userData.companyId || null;

      const token = jwt.sign(
        {
          id: userData._id.toString(),
          roles: userRole,
          email,
          companyId,
        },
        process.env.JWT_SECRET!,
        {
          expiresIn: '10d',
        },
      );

      const fullName = isCompanyAccount
        ? userData.primaryContact?.name || userData.displayName
        : userData.fullName ||
          `${userData.firstName || ''} ${userData.lastName || ''}`.trim();

      const firstName = isCompanyAccount
        ? userData.primaryContact?.name?.split(' ')[0] || userData.displayName
        : userData.firstName || '';

      const lastName = isCompanyAccount
        ? userData.primaryContact?.name?.split(' ').slice(1).join(' ') || ''
        : userData.lastName || '';

      const phoneNumber = isCompanyAccount
        ? userData.primaryContact?.phone
        : userData.phoneNumber;

      const userDataResponse = {
        _id: userData._id,
        firstName,
        lastName,
        name: fullName,
        fullName,
        email,
        phoneNumber,
        role: userRole,
        roles: userRole,
        companyId,
        token,
      };

      return new ApiResponse(200, userDataResponse, Msg.LOGIN_SUCCESS);
    } catch (error) {
      console.log(`error while logging in`, error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }
}
