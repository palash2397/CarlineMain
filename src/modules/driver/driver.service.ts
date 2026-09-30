import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
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
import { generateRandomPassword, deleteOldFile } from 'src/helpers/index';
import { getDriverWelcomeEmailTemplate } from '../mail/template/driver-welcome.template';
import { getDriverRejectionEmailTemplate } from '../mail/template/driver-rejection.template';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';
import { UpdateDriverProfileDto } from './dto/update-driver-profile.dto';
import { UpdateDriverVehicleTypeDto } from './dto/update-driver-vehicle-type.dto';
import { CompanyStatus } from 'src/common/enums/companies/status-enum';
import { VehicleTypeService } from '../vehicle-type/vehicle-type.service';

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
    private readonly vehicleTypeService: VehicleTypeService,
  ) {}

  private formatDriverResponse(driver: any) {
    if (!driver) return driver;
    const item = driver.toObject ? driver.toObject() : { ...driver };
    const baseUrl = (process.env.BASE_URL || 'http://localhost:4016').replace(
      /\/$/,
      '',
    );

    delete item.password;
    delete item.otp;
    delete item.otpExpireAt;

    if (item.avatar) {
      const filename = item.avatar.split('/').pop();
      item.avatar = filename
        ? `${baseUrl}/api/v1/uploads/driver/${filename}`
        : process.env.DEFAULT_IMAGE || null;
    } else {
      item.avatar = process.env.DEFAULT_IMAGE || null;
    }

    const docFields = [
      'insuranceProofUrl',
      'governmentIdUrl',
      'licenseCopyUrl',
      'vehicleRegistrationDocUrl',
    ];
    docFields.forEach((docField) => {
      if (item[docField]) {
        const filename = item[docField].split('/').pop();
        item[docField] = filename
          ? `${baseUrl}/api/v1/uploads/driver/${filename}`
          : process.env.DEFAULT_IMAGE_FOR_EVERYTHING || null;
      } else {
        item[docField] = process.env.DEFAULT_IMAGE_FOR_EVERYTHING || null;
      }
    });

    return item;
  }

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

      const existingLicense = await this.driverModel.findOne({ licenseNumber });
      if (existingLicense) {
        return new ApiResponse(400, {}, Msg.DRIVER_EXISTS_LICENSE);
      }

      const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');

      let governmentIdUrl: string | null = null;
      let licenseCopyUrl: string | null = null;
      let vehicleRegistrationDocUrl: string | null = null;
      let insuranceProofUrl: string | null = null;

      if (files?.governmentId?.[0]) {
        governmentIdUrl = files.governmentId[0].filename;
      }
      if (files?.licenseCopy?.[0]) {
        licenseCopyUrl = files.licenseCopy[0].filename;
      }
      if (files?.vehicleRegistrationDoc?.[0]) {
        vehicleRegistrationDocUrl = files.vehicleRegistrationDoc[0].filename;
      }
      if (files?.insuranceProof?.[0]) {
        insuranceProofUrl = files.insuranceProof[0].filename;
      }

      const company = await this.companyModel.findById(dto.companyId);
      if (!company) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      let vehicleType = dto.vehicleType?.trim() || null;
      let vehicleTypeId: string | null = null;

      if (vehicleType) {
        if (isValidObjectId(vehicleType)) {
          vehicleTypeId = vehicleType;
          const vType =
            await this.vehicleTypeService.getVehicleTypeById(vehicleType);
          if (vType?.data && (vType.data as any).name) {
            vehicleType = (vType.data as any).name;
          }
        }
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
        vehicleTypeId,
        vehicleType,
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
        vehicleTypeId: createdDriver.vehicleTypeId,
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

  async getCompanyDrivers(dto: any, userOrId: any) {
    try {
      const page = Math.max(1, parseInt(dto?.page) || 1);
      const limit = Math.max(1, parseInt(dto?.limit) || 10);
      const skip = (page - 1) * limit;

      const userId =
        typeof userOrId === 'string' ? userOrId : userOrId?.id || userOrId?._id;
      const userRoles = Array.isArray(userOrId?.roles)
        ? userOrId.roles
        : [userOrId?.roles || userOrId?.role].filter(Boolean);
      const isSuperAdmin =
        userRoles.includes(UserRole.SUPERADMIN) ||
        userRoles.includes(UserRole.ADMIN);

      let companyFilter: any = {};
      let targetCompany: any = null;

      if (isSuperAdmin) {
        if (dto?.companyId) {
          if (isValidObjectId(dto.companyId)) {
            targetCompany = await this.companyModel.findById(dto.companyId);
          }
          if (!targetCompany) {
            targetCompany = await this.companyModel.findOne({
              companyId: dto.companyId,
            });
          }
          if (targetCompany) {
            const cIds = [
              targetCompany._id.toString(),
              targetCompany.companyId,
            ].filter(Boolean);
            companyFilter.companyId = { $in: cIds };
          } else {
            companyFilter.companyId = dto.companyId;
          }
        }
      } else {
        if (userId && isValidObjectId(userId)) {
          targetCompany = await this.companyModel.findOne({ _id: userId });
        }
        if (!targetCompany && userId) {
          const compUser = await this.companyUserModel.findOne({ _id: userId });
          if (compUser && compUser.companyId) {
            targetCompany = await this.companyModel.findOne({
              $or: [
                ...(isValidObjectId(compUser.companyId)
                  ? [{ _id: compUser.companyId }]
                  : []),
                { companyId: compUser.companyId },
              ],
            });
          }
        }

        if (!targetCompany && userOrId?.companyId) {
          targetCompany = await this.companyModel.findOne({
            $or: [
              ...(isValidObjectId(userOrId.companyId)
                ? [{ _id: userOrId.companyId }]
                : []),
              { companyId: userOrId.companyId },
            ],
          });
        }

        if (!targetCompany) {
          return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
        }

        const cIds = [
          targetCompany._id.toString(),
          targetCompany.companyId,
        ].filter(Boolean);
        companyFilter.companyId = { $in: cIds };
      }

      const filter: any = { ...companyFilter };

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

      if (dto?.vehicleType) {
        filter.vehicleType = dto.vehicleType;
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
        {
          drivers: drivers.map((driver: any) =>
            this.formatDriverResponse(driver),
          ),
          total,
          page,
          limit,
        },
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

      if (!company && driver.companyId) {
        company = await this.companyModel.findOne({
          $or: [
            ...(isValidObjectId(driver.companyId)
              ? [{ _id: driver.companyId }]
              : []),
            { companyId: driver.companyId },
          ],
        });
      }

      const companyName =
        company?.displayName || company?.legalName || 'Carline';

      const targetStatus = dto.status;
      const previousStatus = driver.status;
      const isFirstTimeApproval =
        (previousStatus === DriverStatus.PENDING_APPROVAL ||
          !driver.isVerified ||
          !driver.password) &&
        (targetStatus === DriverStatus.ACTIVE ||
          String(targetStatus).toUpperCase() === 'APPROVED');

      if (isFirstTimeApproval) {
        // INITIAL APPROVAL: Generate temporary password and send welcome email
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
        targetStatus === DriverStatus.ACTIVE ||
        String(targetStatus).toUpperCase() === 'APPROVED'
      ) {
        // RE-ACTIVATING AN ALREADY APPROVED DRIVER (Keep existing password & do not resend welcome email)
        driver.status = DriverStatus.ACTIVE;
        driver.isActive = true;
        driver.rejectionReason = null;

        await driver.save();

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
          Msg.DRIVER_STATUS_UPDATED,
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
        // TOGGLE TO INACTIVE OR OTHER STATUS
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

  async getMyProfile(driverId: string) {
    try {
      const driver: any = await this.driverModel
        .findById(driverId)
        .select('-password -otp -otpExpireAt')
        .lean();

      if (!driver) {
        return new ApiResponse(404, {}, Msg.DRIVER_NOT_FOUND);
      }

      const formattedDriver = this.formatDriverResponse(driver);

      let company: any = null;
      if (driver.companyId) {
        company = await this.companyModel
          .findById(driver.companyId)
          .select('name legalName code email phone address branding status')
          .lean();
      }

      return new ApiResponse(
        200,
        { ...formattedDriver, company },
        Msg.DRIVER_FETCHED,
      );
    } catch (error) {
      console.error('Error while getting driver profile:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async updateMyProfile(
    driverId: string,
    dto: UpdateDriverProfileDto,
    files?: {
      avatar?: Express.Multer.File[];
      governmentId?: Express.Multer.File[];
      licenseCopy?: Express.Multer.File[];
      vehicleRegistrationDoc?: Express.Multer.File[];
      insuranceProof?: Express.Multer.File[];
    },
  ) {
    try {
      const driver = await this.driverModel.findById(driverId);
      if (!driver) {
        return new ApiResponse(404, {}, Msg.DRIVER_NOT_FOUND);
      }

      const baseUrl = process.env.BASE_URL || 'http://localhost:4016';

      const extractFilename = (url?: string | null) => {
        if (!url) return null;
        const parts = url.split('/');
        return parts[parts.length - 1];
      };

      if (files?.avatar?.[0]) {
        const oldAvatar = extractFilename(driver.avatar);
        if (oldAvatar) deleteOldFile('driver', oldAvatar);
        driver.avatar = files.avatar[0].filename;
      }

      if (files?.governmentId?.[0]) {
        const oldDoc = extractFilename(driver.governmentIdUrl);
        if (oldDoc) deleteOldFile('driver', oldDoc);
        driver.governmentIdUrl = files.governmentId[0].filename;
      }

      if (files?.licenseCopy?.[0]) {
        const oldDoc = extractFilename(driver.licenseCopyUrl);
        if (oldDoc) deleteOldFile('driver', oldDoc);
        driver.licenseCopyUrl = files.licenseCopy[0].filename;
      }

      if (files?.vehicleRegistrationDoc?.[0]) {
        const oldDoc = extractFilename(driver.vehicleRegistrationDocUrl);
        if (oldDoc) deleteOldFile('driver', oldDoc);
        driver.vehicleRegistrationDocUrl =
          files.vehicleRegistrationDoc[0].filename;
      }

      if (files?.insuranceProof?.[0]) {
        const oldDoc = extractFilename(driver.insuranceProofUrl);
        if (oldDoc) deleteOldFile('driver', oldDoc);
        driver.insuranceProofUrl = files.insuranceProof[0].filename;
      }

      const updateFields = [
        'fullName',
        'phoneNumber',
        'dateOfBirth',
        'gender',
        'licenseNumber',
        'licenseClass',
        'issueDate',
        'expiryDate',
        'employmentType',
        'preferredServiceArea',
        'fuelType',
        'transmission',
        'vehicleRegistrationNumber',
        'make',
        'modelAndYear',
      ];

      for (const field of updateFields) {
        if (dto[field] !== undefined && dto[field] !== '') {
          driver[field] =
            typeof dto[field] === 'string' ? dto[field].trim() : dto[field];
        }
      }

      // Handle vehicle type update if provided
      if (dto.vehicleType !== undefined && dto.vehicleType !== '') {
        const targetVehicleType =
          await this.vehicleTypeService.findVehicleTypeByIdOrName(
            dto.vehicleType,
          );
        if (targetVehicleType) {
          driver.vehicleTypeId = targetVehicleType._id.toString();
          driver.vehicleType = targetVehicleType.name;
        } else {
          driver.vehicleType = dto.vehicleType.trim();
        }
      }

      await driver.save();

      const responseData: any = driver.toObject();
      delete responseData.password;
      delete responseData.otp;
      delete responseData.otpExpireAt;

      if (responseData.avatar) {
        responseData.avatar = responseData.avatar.startsWith('http')
          ? responseData.avatar
          : `${baseUrl}/api/v1/uploads/driver/${responseData.avatar}`;
      } else {
        responseData.avatar = process.env.DEFAULT_IMAGE;
      }

      const docFields = [
        'insuranceProofUrl',
        'governmentIdUrl',
        'licenseCopyUrl',
        'vehicleRegistrationDocUrl',
      ];
      docFields.forEach((docField) => {
        if (responseData[docField]) {
          responseData[docField] = responseData[docField].startsWith('http')
            ? responseData[docField]
            : `${baseUrl}/api/v1/uploads/driver/${responseData[docField]}`;
        } else {
          responseData[docField] = process.env.DEFAULT_IMAGE_FOR_EVERYTHING;
        }
      });

      return new ApiResponse(200, responseData, Msg.DRIVER_UPDATED);
    } catch (error) {
      console.error('Error while updating driver profile:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async updateDriverVehicleType(dto: UpdateDriverVehicleTypeDto, user: any) {
    try {
      if (!dto.driverId || !isValidObjectId(dto.driverId)) {
        return new ApiResponse(400, {}, Msg.INVALID_INPUT);
      }

      const driver = await this.driverModel.findById(dto.driverId);
      if (!driver) {
        return new ApiResponse(404, {}, Msg.DRIVER_NOT_FOUND);
      }

      const userRoles = Array.isArray(user?.roles)
        ? user.roles
        : [user?.roles || user?.role];
      const isSuperAdmin =
        userRoles.includes(UserRole.SUPERADMIN) ||
        userRoles.includes(UserRole.ADMIN);

      if (!isSuperAdmin) {
        let company = await this.companyModel.findOne({ _id: user.id });
        if (!company) {
          const compUser = await this.companyUserModel.findOne({
            _id: user.id,
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

        if (!company) {
          return new ApiResponse(
            403,
            {},
            'Company account not found or access forbidden',
          );
        }

        const companyIds = [company._id.toString(), company.companyId].filter(
          Boolean,
        );

        const isDriverBelongsToCompany =
          driver.companyId && companyIds.includes(driver.companyId.toString());

        if (!isDriverBelongsToCompany) {
          return new ApiResponse(
            403,
            {},
            'Unauthorized: You can only change the vehicle type for drivers registered with your company.',
          );
        }
      }

      // Resolve Vehicle Type by ID or Name from SuperAdmin vehicle classes
      const targetVehicleType =
        await this.vehicleTypeService.findVehicleTypeByIdOrName(
          dto.vehicleType,
        );

      if (!targetVehicleType) {
        return new ApiResponse(404, {}, Msg.VEHICLE_TYPE_NOT_FOUND);
      }

      driver.vehicleTypeId = targetVehicleType._id.toString();
      driver.vehicleType = targetVehicleType.name;

      await driver.save();

      const responseData: any = driver.toObject();
      delete responseData.password;
      delete responseData.otp;
      delete responseData.otpExpireAt;

      return new ApiResponse(
        200,
        responseData,
        'Driver vehicle type updated successfully',
      );
    } catch (error: any) {
      console.error('Error while updating driver vehicle type:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  async allCompanies() {
    try {
      const companies = await this.companyModel.find({
        status: CompanyStatus.ACTIVE,
        isVerified: true,
      });

      if (!companies || companies.length == 0) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }
      return new ApiResponse(200, companies, Msg.COMPANIES_FETCHED);
    } catch (error) {
      console.error('Error while fetching all companies:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async getAvailableVehicleTypes() {
    try {
      return this.vehicleTypeService.getActiveVehicleTypes();
    } catch (error) {
      console.error('Error while fetching vehicle types for driver:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }
}
