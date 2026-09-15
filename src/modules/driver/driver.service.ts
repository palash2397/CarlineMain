import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Driver, DriverDocument } from './schema/driver.schema';
import { RegisterDriverDto } from './dto/register-driver.dto';
import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';
import { DriverStatus } from 'src/common/enums/driver/status-enum';
import { UserRole } from 'src/common/enums/user/role.enum';

import { Company, CompanyDocument } from '../super-admin/schema/company.schema';
import {
  CompanyUser,
  CompanyUserDocument,
} from '../company-user/schema/company-user.schema';
import { MailService } from '../mail/mail.service';
import { generateRandomPassword } from 'src/helpers/index';
import { getDriverWelcomeEmailTemplate } from '../mail/template/driver-welcome.template';
import { getDriverRejectionEmailTemplate } from '../mail/template/driver-rejection.template';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';

@Injectable()
export class DriverService {
  constructor(
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(CompanyUser.name)
    private readonly companyUserModel: Model<CompanyUserDocument>,
    private readonly mailService: MailService,
  ) {}

  async registerDriver(
    dto: RegisterDriverDto,
    files?: {
      governmentId?: Express.Multer.File[];
      licenseCopy?: Express.Multer.File[];
      vehicleRegistrationDoc?: Express.Multer.File[];
      insuranceProof?: Express.Multer.File[];
    },
  ) {
    try {
      if (!dto.termsAccepted) {
        return new ApiResponse(400, {}, Msg.TERMS_ACCEPTED);
      }

      const email = dto.email.toLowerCase().trim();
      const phoneNumber = dto.phoneNumber.trim();
      const licenseNumber = dto.licenseNumber.toUpperCase().trim();
      const vehicleRegistrationNumber = dto.vehicleRegistrationNumber
        .toUpperCase()
        .trim();

      const existingEmail = await this.driverModel.findOne({ email });
      if (existingEmail) {
        return new ApiResponse(400, {}, Msg.USER_EXISTS_EMAIL);
      }

      const existingPhone = await this.driverModel.findOne({ phoneNumber });
      if (existingPhone) {
        return new ApiResponse(400, {}, Msg.USER_EXISTS_PHONE);
      }

      // Check existing license number
      const existingLicense = await this.driverModel.findOne({ licenseNumber });
      if (existingLicense) {
        return new ApiResponse(400, {}, Msg.DRIVER_EXISTS_LICENSE);
      }

      // Resolve base URL for uploaded file URLs
      const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');

      // Assign uploaded file URLs
      let governmentIdUrl: string | null = null;
      let licenseCopyUrl: string | null = null;
      let vehicleRegistrationDocUrl: string | null = null;
      let insuranceProofUrl: string | null = null;

      if (files?.governmentId?.[0]) {
        governmentIdUrl = `${baseUrl}/api/v1/uploads/driver/${files.governmentId[0].filename}`;
      }
      if (files?.licenseCopy?.[0]) {
        licenseCopyUrl = `${baseUrl}/api/v1/uploads/driver/${files.licenseCopy[0].filename}`;
      }
      if (files?.vehicleRegistrationDoc?.[0]) {
        vehicleRegistrationDocUrl = `${baseUrl}/api/v1/uploads/driver/${files.vehicleRegistrationDoc[0].filename}`;
      }
      if (files?.insuranceProof?.[0]) {
        insuranceProofUrl = `${baseUrl}/api/v1/uploads/driver/${files.insuranceProof[0].filename}`;
      }

      const createdDriver = await this.driverModel.create({
        fullName: dto.fullName.trim(),
        dateOfBirth: dto.dateOfBirth.trim(),
        gender: dto.gender.trim(),
        phoneNumber,
        email,
        companyId: dto.companyId || null,
        licenseNumber,
        licenseClass: dto.licenseClass?.trim() || null,
        issueDate: dto.issueDate?.trim() || null,
        expiryDate: dto.expiryDate.trim(),
        employmentType: dto.employmentType?.trim() || 'Full Time Driver',
        preferredServiceArea: dto.preferredServiceArea?.trim() || null,
        vehicleType: dto.vehicleType?.trim() || null,
        fuelType: dto.fuelType?.trim() || null,
        transmission: dto.transmission?.trim() || null,
        vehicleRegistrationNumber,
        make: dto.make?.trim() || null,
        modelAndYear: dto.modelAndYear?.trim() || null,
        governmentIdUrl,
        licenseCopyUrl,
        vehicleRegistrationDocUrl,
        insuranceProofUrl,
        termsAccepted: dto.termsAccepted,
        status: DriverStatus.PENDING_APPROVAL,
        role: UserRole.DRIVER,
        isActive: false,
        isVerified: false,
      });

      const responseData = {
        _id: createdDriver._id,
        fullName: createdDriver.fullName,
        email: createdDriver.email,
        phoneNumber: createdDriver.phoneNumber,
        companyId: createdDriver.companyId,
        dateOfBirth: createdDriver.dateOfBirth,
        gender: createdDriver.gender,
        licenseNumber: createdDriver.licenseNumber,
        licenseClass: createdDriver.licenseClass,
        issueDate: createdDriver.issueDate,
        expiryDate: createdDriver.expiryDate,
        employmentType: createdDriver.employmentType,
        preferredServiceArea: createdDriver.preferredServiceArea,
        vehicleType: createdDriver.vehicleType,
        fuelType: createdDriver.fuelType,
        transmission: createdDriver.transmission,
        vehicleRegistrationNumber: createdDriver.vehicleRegistrationNumber,
        make: createdDriver.make,
        modelAndYear: createdDriver.modelAndYear,
        governmentIdUrl: createdDriver.governmentIdUrl,
        licenseCopyUrl: createdDriver.licenseCopyUrl,
        vehicleRegistrationDocUrl: createdDriver.vehicleRegistrationDocUrl,
        insuranceProofUrl: createdDriver.insuranceProofUrl,
        status: createdDriver.status,
        role: createdDriver.role,
        isActive: createdDriver.isActive,
        isVerified: createdDriver.isVerified,
        createdAt: (createdDriver as any).createdAt,
      };

      return new ApiResponse(
        201,
        responseData,
        Msg.DRIVER_APPLICATION_SUBMITTED,
      );
    } catch (error) {
      console.error('Error while registering driver:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  async getCompanyDrivers(dto: any, id: string) {
    try {
      const page = parseInt(dto?.page) || 1;
      const limit = parseInt(dto?.limit) || 10;
      const skip = (page - 1) * limit;

      let company = await this.companyModel.findOne({ _id: id });
      if (!company) {
        const companyUser = await this.companyUserModel.findOne({ _id: id });
        if (companyUser) {
          company = await this.companyModel.findOne({
            $or: [
              { _id: companyUser.companyId },
              { companyId: companyUser.companyId },
            ],
          });
        }
      }

      if (!company) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      const filter: any = {
        companyId: {
          $in: [company._id.toString(), company.companyId].filter(Boolean),
        },
      };

      if (dto?.search) {
        filter.$or = [
          { fullName: { $regex: dto.search, $options: 'i' } },
          { email: { $regex: dto.search, $options: 'i' } },
          { phoneNumber: { $regex: dto.search, $options: 'i' } },
          { licenseNumber: { $regex: dto.search, $options: 'i' } },
          { vehicleRegistrationNumber: { $regex: dto.search, $options: 'i' } },
        ];
      }

      if (dto?.status && dto.status !== 'All') {
        filter.status = dto.status;
      }

      const total = await this.driverModel.countDocuments(filter);
      const drivers = await this.driverModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-password');

      return new ApiResponse(
        200,
        { drivers, total, page, limit },
        Msg.DRIVERS_FETCHED,
      );
    } catch (error) {
      console.log('error while getting company drivers', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async updateDriverStatus(dto: UpdateDriverStatusDto, adminUserId: string) {
    try {
      const driver = await this.driverModel
        .findById(dto.driverId)
        .select('+password');
      if (!driver) {
        return new ApiResponse(404, {}, Msg.DRIVER_NOT_FOUND);
      }

      let company = await this.companyModel.findOne({ _id: adminUserId });
      if (!company) {
        const compUser = await this.companyUserModel.findOne({
          _id: adminUserId,
        });
        if (compUser) {
          company = await this.companyModel.findOne({
            $or: [
              { _id: compUser.companyId },
              { companyId: compUser.companyId },
            ],
          });
        }
      }

      const companyName =
        company?.displayName || company?.legalName || 'Carline';

      const targetStatus = dto.status;

      if (
        targetStatus === DriverStatus.ACTIVE ||
        String(targetStatus).toUpperCase() === 'APPROVED'
      ) {
        // APPROVE DRIVER
        const tempPassword = generateRandomPassword(8);

        driver.status = DriverStatus.ACTIVE;
        driver.isActive = true;
        driver.isVerified = true;
        driver.password = tempPassword;
        driver.rejectionReason = null;

        await driver.save();

        try {
          const loginUrl =
            process.env.DRIVER_LOGIN_URL ||
            process.env.FRONTEND_URL ||
            'https://driver.carline.com/login';
          const emailHtml = getDriverWelcomeEmailTemplate(
            driver.fullName,
            companyName,
            driver.email,
            tempPassword,
            loginUrl,
          );

          await this.mailService.sendEmail(
            driver.email,
            `Your Driver Account is Approved - ${companyName}`,
            `Welcome to ${companyName}! Your driver account has been approved. Your temporary password is: ${tempPassword}`,
            emailHtml,
          );
        } catch (mailError) {
          console.error('Failed to send driver approval email:', mailError);
        }

        return new ApiResponse(
          200,
          {
            _id: driver._id,
            fullName: driver.fullName,
            email: driver.email,
            status: driver.status,
            isActive: driver.isActive,
            isVerified: driver.isVerified,
          },
          Msg.DRIVER_APPROVED,
        );
      } else if (
        targetStatus === DriverStatus.REJECTED ||
        String(targetStatus).toUpperCase() === 'REJECTED'
      ) {
        // REJECT DRIVER
        driver.status = DriverStatus.REJECTED;
        driver.isActive = false;
        driver.rejectionReason = dto.rejectionReason?.trim() || null;

        await driver.save();

        try {
          const emailHtml = getDriverRejectionEmailTemplate(
            driver.fullName,
            companyName,
            driver.rejectionReason || undefined,
          );

          await this.mailService.sendEmail(
            driver.email,
            `Driver Application Status Update - ${companyName}`,
            `Your driver application for ${companyName} has been rejected.`,
            emailHtml,
          );
        } catch (mailError) {
          console.error('Failed to send driver rejection email:', mailError);
        }

        return new ApiResponse(
          200,
          {
            _id: driver._id,
            fullName: driver.fullName,
            email: driver.email,
            status: driver.status,
            isActive: driver.isActive,
            rejectionReason: driver.rejectionReason,
          },
          Msg.DRIVER_STATUS_UPDATED,
        );
      } else {
        driver.status = targetStatus;
        if (targetStatus === DriverStatus.INACTIVE) {
          driver.isActive = false;
        }
        await driver.save();

        return new ApiResponse(
          200,
          {
            _id: driver._id,
            fullName: driver.fullName,
            status: driver.status,
            isActive: driver.isActive,
          },
          Msg.DRIVER_STATUS_UPDATED,
        );
      }
    } catch (error) {
      console.error('Error while updating driver status:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }
}
