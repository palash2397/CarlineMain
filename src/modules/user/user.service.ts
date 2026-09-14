import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { ApiResponse } from 'src/helpers/ApiResponse';
import {
  generateOtp,
  getExpirationTime,
  deleteOldFile,
} from 'src/helpers/index';

import { UpdateProfileDto } from './dto/update-profile.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

import { getOtpEmailTemplate } from '../mail/template/otp.template';

import { Msg } from 'src/helpers/responseMsg';
import { User, UserDocument } from './schema/user.schema';
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
import { MailService } from '../mail/mail.service';

@Injectable()
export class UserService {
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

  async myProfile(userId: string) {
    try {
      let user: any = await this.userModel
        .findById(userId)
        .select('-otp -otpExpireAt')
        .lean();

      if (!user) {
        user = await this.companyUserModel
          .findById(userId)
          .select('-password -otp -otpExpireAt')
          .lean();
      }

      if (!user) {
        const company: any = await this.companyModel
          .findById(userId)
          .select('-password -otp -otpExpireAt')
          .lean();

        if (company) {
          user = {
            _id: company._id,
            firstName:
              company.primaryContact?.name?.split(' ')[0] ||
              company.displayName,
            lastName:
              company.primaryContact?.name?.split(' ').slice(1).join(' ') ||
              '',
            fullName: company.primaryContact?.name || company.displayName,
            email: company.primaryContact?.email,
            phoneNumber: company.primaryContact?.phone,
            role: company.role || 'COMPANY_ADMIN',
            companyId: company._id.toString(),
            avatar: company.branding?.logo || null,
            company,
          };
        }
      }

      if (!user) {
        const driver: any = await this.driverModel
          .findById(userId)
          .select('-password -otp -otpExpireAt')
          .lean();

        if (driver) {
          user = {
            _id: driver._id,
            firstName: driver.firstName,
            lastName: driver.lastName,
            fullName: driver.fullName,
            email: driver.email,
            phoneNumber: driver.phoneNumber,
            role: driver.role || 'DRIVER',
            companyId: driver.companyId,
            avatar: driver.avatar || null,
            driver,
          };
        }
      }

      if (!user) {
        return new ApiResponse(400, {}, Msg.USER_NOT_FOUND);
      }

      user.avatar = user.avatar
        ? `${process.env.BASE_URL}/api/v1/uploads/profile/${user.avatar}`
        : process.env.DEFAULT_IMAGE;

      return new ApiResponse(200, user, Msg.USER_FETCHED);
    } catch (error) {
      console.log('error while getting my profile', error);

      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    file?: Express.Multer.File,
  ) {
    try {
      const user = await this.userModel.findOne({ _id: userId });
      if (!user) {
        return new ApiResponse(404, {}, Msg.USER_NOT_FOUND);
      }

      const updateData: any = {};
      Object.keys(dto).forEach((key) => {
        if (dto[key as keyof UpdateProfileDto] !== '') {
          updateData[key] = dto[key as keyof UpdateProfileDto];
        }
      });

      const updatedUser = await this.userModel.findOneAndUpdate(
        { _id: user._id },
        { $set: updateData },
        { new: true },
      );

      if (!updatedUser) {
        return new ApiResponse(404, {}, Msg.USER_NOT_FOUND);
      }

      await updatedUser.save();

      console.log(`updated user ----------->`, updatedUser);

      if (file) {
        if (user.avatar) {
          deleteOldFile('user', user.avatar);
        }

        updatedUser.avatar = file.filename;
        await updatedUser.save();
      }

      updatedUser.avatar = updatedUser.avatar
        ? `${process.env.BASE_URL}/api/v1/uploads/profile/${updatedUser.avatar}`
        : process.env.DEFAULT_IMAGE;

      const data = {
        _id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phoneNumber: updatedUser.phoneNumber,
        email: updatedUser.email,
        role: updatedUser.role,
        avatar: updatedUser.avatar,
        gender: updatedUser.gender,
        dob: updatedUser.dob,
      };

      return new ApiResponse(200, data, Msg.USER_UPDATED);
    } catch (error) {
      console.log('error while updating profile', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    try {
      const normalizedEmail = (dto.email || '').toLowerCase().trim();
      let user: any = await this.userModel.findOne({ email: normalizedEmail });
      if (!user) {
        user = await this.companyUserModel.findOne({ email: normalizedEmail });
      }
      if (!user) {
        user = await this.companyModel.findOne({
          'primaryContact.email': normalizedEmail,
        });
      }
      if (!user) {
        user = await this.driverModel.findOne({ email: normalizedEmail });
      }
      if (!user) {
        return new ApiResponse(404, {}, Msg.USER_NOT_FOUND);
      }
      const otp = generateOtp();
      const otpExpiry = getExpirationTime();

      user.otp = otp;
      user.otpExpireAt = otpExpiry;
      await user.save();

      const recipientName =
        user.firstName ||
        (user.fullName ? user.fullName.split(' ')[0] : null) ||
        (user.primaryContact ? user.primaryContact.name : 'User');

      await this.mailService.sendEmail(
        normalizedEmail,
        'Forgot Password',
        `Your OTP is ${otp}`,
        getOtpEmailTemplate(otp, recipientName),
      );

      return new ApiResponse(200, {}, Msg.OTP_SENT);
    } catch (error) {
      console.log('error while forgot password', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async resetPassword(dto: ResetPasswordDto) {
    try {
      const { password } = dto;
      const normalizedEmail = (dto.email || '').toLowerCase().trim();

      let user: any = await this.userModel
        .findOne({ email: normalizedEmail })
        .select('+password');
      if (!user) {
        user = await this.companyUserModel
          .findOne({ email: normalizedEmail })
          .select('+password');
      }
      if (!user) {
        user = await this.companyModel
          .findOne({
            'primaryContact.email': normalizedEmail,
          })
          .select('+password');
      }
      if (!user) {
        user = await this.driverModel
          .findOne({ email: normalizedEmail })
          .select('+password');
      }
      if (!user) {
        return new ApiResponse(404, {}, Msg.USER_NOT_FOUND);
      }

      if (!user.isPasswordReset) {
        return new ApiResponse(400, {}, Msg.OTP_INVALID);
      }

      if (user.password) {
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (isPasswordValid) {
          return new ApiResponse(400, {}, Msg.ENTERED_OLD_PASSWORD);
        }
      }

      user.password = password!;
      user.otp = undefined;
      user.otpExpireAt = undefined;
      user.isPasswordReset = false;
      await user.save();

      return new ApiResponse(200, {}, Msg.PASSWORD_CHANGED);
    } catch (error) {
      console.log('error while resetting password', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }
}
