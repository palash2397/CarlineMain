import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Driver, DriverDocument } from './schema/driver.schema';
import { Company, CompanyDocument } from '../super-admin/schema/company.schema';
import {
  CompanyUser,
  CompanyUserDocument,
} from '../company-user/schema/company-user.schema';
import { User, UserDocument } from '../user/schema/user.schema';
import { MailService } from '../mail/mail.service';
import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';
import { generateRandomPassword } from 'src/helpers/index';
import { UserRole } from 'src/common/enums/user/role.enum';
import { DriverStatus } from 'src/common/enums/driver/status-enum';
import { getDriverWelcomeEmailTemplate } from '../mail/template/driver-welcome.template';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';
import { GetDriversQueryDto } from './dto/get-drivers-query.dto';

@Injectable()
export class DriverService {
  constructor(
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(CompanyUser.name)
    private readonly companyUserModel: Model<CompanyUserDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly mailService: MailService,
  ) {}

  async resolveCompanyContext(currentUserOrId: any): Promise<{
    companyId: string | null;
    driverManagerId: string | null;
    createdBy: string | null;
  }> {
    if (!currentUserOrId)
      return { companyId: null, driverManagerId: null, createdBy: null };

    let companyId: string | null = currentUserOrId.companyId || null;
    let driverManagerId: string | null = null;
    let createdBy: string | null = currentUserOrId.email || null;

    const id =
      typeof currentUserOrId === 'string'
        ? currentUserOrId
        : currentUserOrId.id || currentUserOrId._id;

    if (id && isValidObjectId(id)) {
      const compUser = await this.companyUserModel.findById(id);
      if (compUser) {
        companyId = compUser.companyId || companyId;
        driverManagerId = compUser._id.toString();
        createdBy = compUser.email || createdBy;
      } else {
        const comp = await this.companyModel.findById(id);
        if (comp) {
          companyId = comp._id.toString();
          createdBy = comp.primaryContact?.email || 'COMPANY_ADMIN';
        } else {
          const u = await this.userModel.findById(id);
          if (u?.companyId) {
            companyId = u.companyId;
            createdBy = u.email || null;
          }
        }
      }
    }

    return { companyId, driverManagerId, createdBy };
  }

  async createDriver(dto: CreateDriverDto, files: any, currentUser: any) {
    try {
      const userRole = (
        currentUser?.roles ||
        currentUser?.role ||
        ''
      ).toUpperCase();

      const {
        driverManagerId,
        createdBy,
        companyId: resolvedCompanyId,
      } = await this.resolveCompanyContext(currentUser);

      let finalCompanyId = resolvedCompanyId;

      if (
        !finalCompanyId &&
        userRole === UserRole.DRIVER_MANAGER &&
        driverManagerId
      ) {
        const dm = await this.companyUserModel.findById(driverManagerId);
        finalCompanyId = dm?.companyId || null;
      }

      if (!finalCompanyId) {
        return new ApiResponse(400, {}, Msg.COMPANY_CONTEXT_REQUIRED);
      }

      const company = isValidObjectId(finalCompanyId)
        ? await this.companyModel.findById(finalCompanyId)
        : await this.companyModel.findOne({ companyId: finalCompanyId });

      if (!company) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      const normalizedEmail = dto.email.toLowerCase().trim();
      const normalizedPhone = dto.phoneNumber.trim();
      const normalizedLicense = dto.licenseNumber.toUpperCase().trim();

      // Check unique constraints across relevant collections
      const [
        existingEmailDriver,
        existingEmailCompanyUser,
        existingEmailUser,
        existingEmailCompany,
      ] = await Promise.all([
        this.driverModel.findOne({ email: normalizedEmail }),
        this.companyUserModel.findOne({ email: normalizedEmail }),
        this.userModel.findOne({ email: normalizedEmail }),
        this.companyModel.findOne({ 'primaryContact.email': normalizedEmail }),
      ]);

      if (
        existingEmailDriver ||
        existingEmailCompanyUser ||
        existingEmailUser ||
        existingEmailCompany
      ) {
        return new ApiResponse(400, {}, Msg.USER_EXISTS_EMAIL);
      }

      const [existingPhoneDriver, existingPhoneCompanyUser] = await Promise.all(
        [
          this.driverModel.findOne({ phoneNumber: normalizedPhone }),
          this.companyUserModel.findOne({ phoneNumber: normalizedPhone }),
        ],
      );

      if (existingPhoneDriver || existingPhoneCompanyUser) {
        return new ApiResponse(400, {}, Msg.USER_EXISTS_PHONE);
      }

      const existingLicense = await this.driverModel.findOne({
        'license.licenseNumber': normalizedLicense,
      });
      if (existingLicense) {
        return new ApiResponse(400, {}, Msg.DRIVER_EXISTS_LICENSE);
      }

      // Handle file uploads
      let licenseCopyUrl: string | null = null;
      let insuranceProofUrl: string | null = null;

      if (files?.licenseCopy?.[0]) {
        licenseCopyUrl = `/api/v1/uploads/driver/${files.licenseCopy[0].filename}`;
      }
      if (files?.insuranceProof?.[0]) {
        insuranceProofUrl = `/api/v1/uploads/driver/${files.insuranceProof[0].filename}`;
      }

      const tempPassword = generateRandomPassword(8);
      const fullName = `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim();

      const newDriver = new this.driverModel({
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        fullName,
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        address: {
          streetAddress: dto.streetAddress?.trim() || '',
          city: dto.city?.trim() || '',
          zipCode: dto.zipCode?.trim() || '',
        },
        emergencyContact: {
          name: dto.emergencyContactName?.trim() || '',
          phone: dto.emergencyPhone?.trim() || '',
        },
        license: {
          licenseNumber: normalizedLicense,
          licenseClass: dto.licenseClass || 'Class A (Commercial)',
          expiryDate: dto.expiryDate,
          licenseCopyUrl,
        },
        vehicleConfig: {
          vehicleAssignment: dto.vehicleAssignment || 'None (Unassigned)',
          defaultAvailability: dto.defaultAvailability || 'Available',
          dispatchPriority: dto.dispatchPriority || 'Normal',
          restrictions: dto.restrictions || [],
          insuranceProofUrl,
        },
        workingSchedule: {
          monHours: dto.monHours || '08:00 - 18:00',
          tueHours: dto.tueHours || '08:00 - 18:00',
          wedHours: dto.wedHours || '08:00 - 18:00',
          thuHours: dto.thuHours || '08:00 - 18:00',
          friHours: dto.friHours || '08:00 - 18:00',
          satHours: dto.satHours || '08:00 - 18:00',
          sunHours: dto.sunHours || '08:00 - 18:00',
        },
        payout: {
          bankName: dto.bankName?.trim() || '',
          accountNumber: dto.accountNumber?.trim() || '',
          routingCode: dto.routingCode?.trim() || '',
        },
        companyId: company._id.toString(),
        driverManagerId: driverManagerId || null,
        createdBy: createdBy || 'DRIVER_MANAGER',
        password: tempPassword,
        role: UserRole.DRIVER,
        status: dto.status || DriverStatus.ACTIVE,
        isActive: dto.status !== DriverStatus.INACTIVE,
        isVerified: true,
      });

      await newDriver.save();

      // Send welcome credentials email
      try {
        const loginUrl =
          process.env.DRIVER_APP_URL ||
          process.env.FRONTEND_URL ||
          'https://driver.carline.com/login';

        const emailHtml = getDriverWelcomeEmailTemplate(
          fullName,
          company.displayName || company.legalName,
          normalizedEmail,
          tempPassword,
          loginUrl,
        );

        await this.mailService.sendEmail(
          normalizedEmail,
          `Welcome to Carline - Your Driver Credentials for ${company.displayName}`,
          `Welcome to Carline! You have been added as a Driver. Email: ${normalizedEmail}, Password: ${tempPassword}`,
          emailHtml,
        );
        console.log(`✅ Driver welcome email sent to ${normalizedEmail}`);
      } catch (mailErr) {
        console.log(
          `⚠️ Failed to send welcome email to driver ${normalizedEmail}:`,
          mailErr,
        );
      }

      const responseData = {
        driver: {
          _id: newDriver._id,
          fullName: newDriver.fullName,
          firstName: newDriver.firstName,
          lastName: newDriver.lastName,
          email: newDriver.email,
          phoneNumber: newDriver.phoneNumber,
          role: newDriver.role,
          status: newDriver.status,
          companyId: newDriver.companyId,
          driverManagerId: newDriver.driverManagerId,
          license: newDriver.license,
          vehicleConfig: newDriver.vehicleConfig,
          workingSchedule: newDriver.workingSchedule,
          payout: newDriver.payout,
          address: newDriver.address,
          emergencyContact: newDriver.emergencyContact,
          createdAt: (newDriver as any).createdAt,
        },
        temporaryPassword: tempPassword,
      };

      return new ApiResponse(201, responseData, Msg.DRIVER_CREATED);
    } catch (error) {
      console.error('Error while creating driver:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async getDrivers(query: GetDriversQueryDto, currentUser: any) {
    try {
      const userRole = (
        currentUser?.roles ||
        currentUser?.role ||
        ''
      ).toUpperCase();
      const currentUserId = currentUser?.id || currentUser?._id;

      if (
        userRole !== UserRole.COMPANY_ADMIN &&
        userRole !== UserRole.DRIVER_MANAGER &&
        userRole !== UserRole.SUPERADMIN
      ) {
        return new ApiResponse(403, {}, Msg.FORBIDDEN);
      }

      const { companyId, driverManagerId } =
        await this.resolveCompanyContext(currentUser);

      const targetCompanyId = companyId;

      if (!targetCompanyId) {
        return new ApiResponse(400, {}, Msg.COMPANY_CONTEXT_REQUIRED);
      }

      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.max(1, Number(query.limit) || 10);
      const skip = (page - 1) * limit;

      const companyIdCandidates: any[] = [
        targetCompanyId,
        String(targetCompanyId),
      ];
      if (isValidObjectId(targetCompanyId)) {
        companyIdCandidates.push(new Types.ObjectId(targetCompanyId));
      }

      const comp = isValidObjectId(targetCompanyId)
        ? await this.companyModel.findById(targetCompanyId)
        : await this.companyModel.findOne({ companyId: targetCompanyId });
      if (comp) {
        companyIdCandidates.push(comp._id.toString());
        companyIdCandidates.push(comp._id);
        if (comp.companyId) {
          companyIdCandidates.push(comp.companyId);
        }
      }

      const andConditions: any[] = [];

      andConditions.push({ companyId: { $in: companyIdCandidates } });

      // Role-specific scoping:
      if (userRole === UserRole.DRIVER_MANAGER) {
        const dmIds: any[] = [driverManagerId, currentUserId].filter(Boolean);
        if (driverManagerId && isValidObjectId(driverManagerId)) {
          dmIds.push(new Types.ObjectId(driverManagerId));
        }
        if (currentUserId && isValidObjectId(currentUserId)) {
          dmIds.push(new Types.ObjectId(currentUserId));
        }

        andConditions.push({
          $or: [
            { driverManagerId: { $in: dmIds } },
            { createdBy: currentUser?.email },
            { driverManagerId: null },
            { driverManagerId: { $exists: false } },
          ],
        });
      }

      // Search filter
      if (query.search && query.search.trim()) {
        const searchRegex = new RegExp(query.search.trim(), 'i');
        andConditions.push({
          $or: [
            { fullName: searchRegex },
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex },
            { phoneNumber: searchRegex },
            { 'license.licenseNumber': searchRegex },
          ],
        });
      }

      if (query.status && query.status.trim() && query.status !== 'All') {
        andConditions.push({ status: query.status.toUpperCase().trim() });
      }

      if (
        query.availability &&
        query.availability.trim() &&
        query.availability !== 'All'
      ) {
        andConditions.push({
          'vehicleConfig.defaultAvailability': query.availability.trim(),
        });
      }

      if (
        query.dispatchPriority &&
        query.dispatchPriority.trim() &&
        query.dispatchPriority !== 'All'
      ) {
        andConditions.push({
          'vehicleConfig.dispatchPriority': query.dispatchPriority.trim(),
        });
      }

      if (
        query.licenseClass &&
        query.licenseClass.trim() &&
        query.licenseClass !== 'All'
      ) {
        andConditions.push({
          'license.licenseClass': query.licenseClass.trim(),
        });
      }

      const filter: any =
        andConditions.length > 0 ? { $and: andConditions } : {};

      const [drivers, total] = await Promise.all([
        this.driverModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('-password -otp -otpExpireAt')
          .lean()
          .exec(),
        this.driverModel.countDocuments(filter),
      ]);

      return new ApiResponse(
        200,
        {
          data: drivers,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        Msg.DRIVERS_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching drivers:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  private async getCompanyIdCandidates(companyId: string): Promise<any[]> {
    const candidates: any[] = [companyId, String(companyId)];
    if (isValidObjectId(companyId)) {
      candidates.push(new Types.ObjectId(companyId));
    }
    const comp = isValidObjectId(companyId)
      ? await this.companyModel.findById(companyId)
      : await this.companyModel.findOne({ companyId });
    if (comp) {
      candidates.push(comp._id.toString());
      candidates.push(comp._id);
      if (comp.companyId) {
        candidates.push(comp.companyId);
      }
    }
    return candidates;
  }

  async getDriverById(id: string, currentUser: any) {
    try {
      if (!isValidObjectId(id)) {
        return new ApiResponse(400, {}, Msg.BAD_REQUEST);
      }

      const { companyId } = await this.resolveCompanyContext(currentUser);
      const filter: any = { _id: id };
      if (companyId) {
        const companyIds = await this.getCompanyIdCandidates(companyId);
        filter.companyId = { $in: companyIds };
      }

      const driver = await this.driverModel
        .findOne(filter)
        .select('-password -otp -otpExpireAt')
        .lean();

      if (!driver) {
        return new ApiResponse(404, {}, Msg.DRIVER_NOT_FOUND);
      }

      return new ApiResponse(200, driver, Msg.DRIVER_FETCHED);
    } catch (error) {
      console.error('Error while fetching driver:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async updateDriver(dto: UpdateDriverDto, files: any, currentUser: any) {
    try {
      if (!dto.id || !isValidObjectId(dto.id)) {
        return new ApiResponse(400, {}, Msg.BAD_REQUEST);
      }

      const { companyId } = await this.resolveCompanyContext(currentUser);
      const filter: any = { _id: dto.id };
      if (companyId) {
        const companyIds = await this.getCompanyIdCandidates(companyId);
        filter.companyId = { $in: companyIds };
      }

      const driver = await this.driverModel.findOne(filter);
      if (!driver) {
        return new ApiResponse(404, {}, Msg.DRIVER_NOT_FOUND);
      }

      if (dto.email && dto.email.toLowerCase().trim() !== driver.email) {
        const normalizedEmail = dto.email.toLowerCase().trim();
        const existingEmail = await this.driverModel.findOne({
          email: normalizedEmail,
          _id: { $ne: driver._id },
        });
        if (existingEmail) {
          return new ApiResponse(400, {}, Msg.USER_EXISTS_EMAIL);
        }
        driver.email = normalizedEmail;
      }

      if (dto.phoneNumber && dto.phoneNumber.trim() !== driver.phoneNumber) {
        const normalizedPhone = dto.phoneNumber.trim();
        const existingPhone = await this.driverModel.findOne({
          phoneNumber: normalizedPhone,
          _id: { $ne: driver._id },
        });
        if (existingPhone) {
          return new ApiResponse(400, {}, Msg.USER_EXISTS_PHONE);
        }
        driver.phoneNumber = normalizedPhone;
      }

      if (
        dto.licenseNumber &&
        dto.licenseNumber.toUpperCase().trim() !== driver.license?.licenseNumber
      ) {
        const normalizedLicense = dto.licenseNumber.toUpperCase().trim();
        const existingLicense = await this.driverModel.findOne({
          'license.licenseNumber': normalizedLicense,
          _id: { $ne: driver._id },
        });
        if (existingLicense) {
          return new ApiResponse(400, {}, Msg.DRIVER_EXISTS_LICENSE);
        }
        if (!driver.license) {
          driver.license = {} as any;
        }
        driver.license.licenseNumber = normalizedLicense;
      }

      if (dto.firstName) driver.firstName = dto.firstName.trim();
      if (dto.lastName) driver.lastName = dto.lastName.trim();
      if (dto.firstName || dto.lastName) {
        driver.fullName = `${driver.firstName} ${driver.lastName}`.trim();
      }

      // Address & Emergency
      if (dto.streetAddress !== undefined)
        driver.address.streetAddress = dto.streetAddress.trim();
      if (dto.city !== undefined) driver.address.city = dto.city.trim();
      if (dto.zipCode !== undefined)
        driver.address.zipCode = dto.zipCode.trim();
      if (dto.emergencyContactName !== undefined)
        driver.emergencyContact.name = dto.emergencyContactName.trim();
      if (dto.emergencyPhone !== undefined)
        driver.emergencyContact.phone = dto.emergencyPhone.trim();

      // License
      if (dto.licenseClass !== undefined)
        driver.license.licenseClass = dto.licenseClass;
      if (dto.expiryDate !== undefined)
        driver.license.expiryDate = dto.expiryDate;
      if (files?.licenseCopy?.[0]) {
        driver.license.licenseCopyUrl = `/api/v1/uploads/driver/${files.licenseCopy[0].filename}`;
      }

      // Vehicle configuration
      if (dto.vehicleAssignment !== undefined)
        driver.vehicleConfig.vehicleAssignment = dto.vehicleAssignment;
      if (dto.defaultAvailability !== undefined)
        driver.vehicleConfig.defaultAvailability = dto.defaultAvailability;
      if (dto.dispatchPriority !== undefined)
        driver.vehicleConfig.dispatchPriority = dto.dispatchPriority;
      if (dto.restrictions !== undefined)
        driver.vehicleConfig.restrictions = dto.restrictions;
      if (files?.insuranceProof?.[0]) {
        driver.vehicleConfig.insuranceProofUrl = `/api/v1/uploads/driver/${files.insuranceProof[0].filename}`;
      }

      // Schedules
      if (dto.monHours !== undefined)
        driver.workingSchedule.monHours = dto.monHours;
      if (dto.tueHours !== undefined)
        driver.workingSchedule.tueHours = dto.tueHours;
      if (dto.wedHours !== undefined)
        driver.workingSchedule.wedHours = dto.wedHours;
      if (dto.thuHours !== undefined)
        driver.workingSchedule.thuHours = dto.thuHours;
      if (dto.friHours !== undefined)
        driver.workingSchedule.friHours = dto.friHours;
      if (dto.satHours !== undefined)
        driver.workingSchedule.satHours = dto.satHours;
      if (dto.sunHours !== undefined)
        driver.workingSchedule.sunHours = dto.sunHours;

      // Payout
      if (dto.bankName !== undefined)
        driver.payout.bankName = dto.bankName.trim();
      if (dto.accountNumber !== undefined)
        driver.payout.accountNumber = dto.accountNumber.trim();
      if (dto.routingCode !== undefined)
        driver.payout.routingCode = dto.routingCode.trim();

      if (dto.status !== undefined) {
        driver.status = dto.status;
        driver.isActive = dto.status !== DriverStatus.INACTIVE;
      }

      await driver.save();

      return new ApiResponse(200, driver, Msg.DRIVER_UPDATED);
    } catch (error) {
      console.error('Error while updating driver:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async updateDriverStatus(dto: UpdateDriverStatusDto, currentUser: any) {
    try {
      if (!dto.id || !isValidObjectId(dto.id)) {
        return new ApiResponse(400, {}, Msg.BAD_REQUEST);
      }

      const { companyId } = await this.resolveCompanyContext(currentUser);
      const filter: any = { _id: dto.id };
      if (companyId) {
        const companyIds = await this.getCompanyIdCandidates(companyId);
        filter.companyId = { $in: companyIds };
      }

      const driver = await this.driverModel.findOne(filter);
      if (!driver) {
        return new ApiResponse(404, {}, Msg.DRIVER_NOT_FOUND);
      }

      driver.status = dto.status;
      driver.isActive = dto.status !== DriverStatus.INACTIVE;

      await driver.save();

      return new ApiResponse(
        200,
        {
          _id: driver._id,
          status: driver.status,
          isActive: driver.isActive,
        },
        Msg.DRIVER_STATUS_UPDATED,
      );
    } catch (error) {
      console.error('Error while updating driver status:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async resendCredentials(id: string, currentUser: any) {
    try {
      if (!isValidObjectId(id)) {
        return new ApiResponse(400, {}, Msg.BAD_REQUEST);
      }

      const { companyId } = await this.resolveCompanyContext(currentUser);
      const filter: any = { _id: id };
      if (companyId) {
        const companyIds = await this.getCompanyIdCandidates(companyId);
        filter.companyId = { $in: companyIds };
      }

      const driver = await this.driverModel.findOne(filter);
      if (!driver) {
        return new ApiResponse(404, {}, Msg.DRIVER_NOT_FOUND);
      }

      const company = await this.companyModel.findById(driver.companyId);
      const companyName =
        company?.displayName || company?.legalName || 'Carline';

      const tempPassword = generateRandomPassword(8);
      driver.password = tempPassword;
      await driver.save();

      const loginUrl =
        process.env.DRIVER_APP_URL ||
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
        `Your Driver Account Credentials - ${companyName}`,
        `Your temporary credentials: Email: ${driver.email}, Password: ${tempPassword}`,
        emailHtml,
      );

      return new ApiResponse(
        200,
        {
          email: driver.email,
          temporaryPassword: tempPassword,
        },
        Msg.CREDENTIALS_RESENT,
      );
    } catch (error) {
      console.error('Error while resending driver credentials:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async deleteDriver(id: string, currentUser: any) {
    try {
      if (!isValidObjectId(id)) {
        return new ApiResponse(400, {}, Msg.BAD_REQUEST);
      }

      const { companyId } = await this.resolveCompanyContext(currentUser);
      const filter: any = { _id: id };
      if (companyId) {
        const companyIds = await this.getCompanyIdCandidates(companyId);
        filter.companyId = { $in: companyIds };
      }

      const driver = await this.driverModel.findOneAndDelete(filter);
      if (!driver) {
        return new ApiResponse(404, {}, Msg.DRIVER_NOT_FOUND);
      }

      return new ApiResponse(200, {}, Msg.DRIVER_DELETED);
    } catch (error) {
      console.error('Error while deleting driver:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }
}
