import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { User, UserDocument } from '../user/schema/user.schema';
import { Company, CompanyDocument } from '../super-admin/schema/company.schema';
import { CompanyUser, CompanyUserDocument } from './schema/company-user.schema';
import { MailService } from '../mail/mail.service';
import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';
import { generateRandomPassword } from 'src/helpers/index';
import { UserRole } from 'src/common/enums/user/role.enum';
import { getTeamMemberWelcomeEmailTemplate } from '../mail/template/team-welcome.template';
import { CreateCompanyUserDto } from './dto/create-company-user.dto';
import { UpdateCompanyUserDto } from './dto/update-company-user.dto';
import { UpdateCompanyUserStatusDto } from './dto/update-company-user-status.dto';
import { GetCompanyUsersQueryDto } from './dto/get-company-users-query.dto';

@Injectable()
export class CompanyUserService {
  constructor(
    @InjectModel(CompanyUser.name)
    private readonly companyUserModel: Model<CompanyUserDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    private readonly mailService: MailService,
  ) {}

  private async resolveCompanyId(currentUserOrId: any): Promise<string | null> {
    if (!currentUserOrId) return null;

    if (currentUserOrId.companyId) {
      return currentUserOrId.companyId;
    }

    const id =
      typeof currentUserOrId === 'string'
        ? currentUserOrId
        : currentUserOrId.id || currentUserOrId._id;

    if (!id) return null;

    if (isValidObjectId(id)) {
      const compUser = await this.companyUserModel.findById(id);
      if (compUser?.companyId) return compUser.companyId;

      const user = await this.userModel.findById(id);
      if (user?.companyId) return user.companyId;

      const comp = await this.companyModel.findById(id);
      if (comp) return comp._id.toString();
    } else {
      const comp = await this.companyModel.findOne({
        $or: [{ companyId: id }, { companyCode: id.toUpperCase() }],
      });
      if (comp) return comp._id.toString();
    }

    return null;
  }

  async createCompanyUser(dto: CreateCompanyUserDto, currentUserOrId: any) {
    try {
      const companyId = await this.resolveCompanyId(currentUserOrId);
      if (!companyId) {
        return new ApiResponse(400, {}, Msg.COMPANY_CONTEXT_REQUIRED);
      }

      const company = isValidObjectId(companyId)
        ? await this.companyModel.findById(companyId)
        : await this.companyModel.findOne({ companyId });

      if (!company) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      const normalizedEmail = (dto.email || '').toLowerCase().trim();

      const existingInCompanyUser = await this.companyUserModel.findOne({
        email: normalizedEmail,
      });
      const existingInUser = await this.userModel.findOne({
        email: normalizedEmail,
      });

      if (existingInCompanyUser || existingInUser) {
        return new ApiResponse(400, {}, Msg.USER_EXISTS_EMAIL);
      }

      if (dto.phoneNumber) {
        const existingPhone = await this.companyUserModel.findOne({
          phoneNumber: dto.phoneNumber.trim(),
        });
        if (existingPhone) {
          return new ApiResponse(400, {}, Msg.USER_EXISTS_PHONE);
        }
      }

      const nameParts = dto.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || 'Member';
      const lastName = nameParts.slice(1).join(' ') || '';

      let role = dto.role.toUpperCase().replace(/\s+/g, '_');
      if (role === 'ACCOUNTING') {
        role = 'ACCOUNTANT';
      }

      const tempPassword = generateRandomPassword(8);

      const newCompanyUser = new this.companyUserModel({
        fullName: dto.fullName.trim(),
        firstName,
        lastName,
        email: normalizedEmail,
        phoneNumber: dto.phoneNumber?.trim() || undefined,
        password: tempPassword,
        role: role as UserRole,
        companyId: company._id.toString(),
        status: dto.status || 'Active',
        isActive: dto.status !== 'Inactive',
        isVerified: true,
      });

      await newCompanyUser.save();

      try {
        const loginUrl =
          process.env.FRONTEND_URL || 'https://admin.carline.com/login';
        const emailHtml = getTeamMemberWelcomeEmailTemplate(
          dto.fullName.trim(),
          company.displayName || company.legalName,
          normalizedEmail,
          dto.role,
          tempPassword,
          loginUrl,
        );

        await this.mailService.sendEmail(
          normalizedEmail,
          `Welcome to ${company.displayName || company.legalName} - Your Login Credentials`,
          `Your temporary password is: ${tempPassword}`,
          emailHtml,
        );
      } catch (mailError) {
        console.error('Failed to send team member welcome email:', mailError);
      }

      const responseData = {
        _id: newCompanyUser._id,
        fullName: newCompanyUser.fullName,
        firstName: newCompanyUser.firstName,
        lastName: newCompanyUser.lastName,
        email: newCompanyUser.email,
        phoneNumber: newCompanyUser.phoneNumber,
        role: newCompanyUser.role,
        status: newCompanyUser.status,
        companyId: newCompanyUser.companyId,
        createdAt: (newCompanyUser as any).createdAt,
      };

      return new ApiResponse(201, responseData, Msg.COMPANY_USER_CREATED);
    } catch (error) {
      console.error('Error while creating company user:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async getCompanyUsers(query: GetCompanyUsersQueryDto, id: any) {
    try {
      const companyId = await this.resolveCompanyId(id);
      if (!companyId) {
        return new ApiResponse(400, {}, Msg.COMPANY_CONTEXT_REQUIRED);
      }

      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.max(1, Number(query.limit) || 10);
      const skip = (page - 1) * limit;

      const filter: any = {
        companyId: companyId,
      };

      if (query.search) {
        const searchRegex = new RegExp(query.search.trim(), 'i');
        filter.$or = [
          { fullName: searchRegex },
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex },
        ];
      }

      if (query.role && query.role !== 'All') {
        let role = query.role.toUpperCase().replace(/\s+/g, '_');
        if (role === 'ACCOUNTING') role = 'ACCOUNTANT';
        filter.role = role;
      }

      if (query.status && query.status !== 'All') {
        filter.status = query.status;
      }

      const [users, total] = await Promise.all([
        this.companyUserModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('-password -otp -otpExpireAt')
          .lean()
          .exec(),
        this.companyUserModel.countDocuments(filter),
      ]);

      const formattedUsers = users.map((u) => ({
        _id: u._id,
        fullName:
          u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim(),
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phoneNumber: u.phoneNumber,
        role: u.role,
        status: u.status || (u.isActive ? 'Active' : 'Inactive'),
        companyId: u.companyId,
        avatar: u.avatar || null,
        createdAt: (u as any).createdAt,
      }));

      return new ApiResponse(
        200,
        {
          data: formattedUsers,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        Msg.COMPANY_USERS_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching company users:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async getCompanyUserById(id: string, currentUserOrId: any) {
    try {
      if (!isValidObjectId(id)) {
        return new ApiResponse(400, {}, Msg.INVALID_INPUT);
      }

      const companyId = await this.resolveCompanyId(currentUserOrId);
      if (!companyId) {
        return new ApiResponse(400, {}, Msg.COMPANY_CONTEXT_REQUIRED);
      }

      const user = await this.companyUserModel
        .findById(id)
        .select('-password -otp -otpExpireAt')
        .lean();
      if (!user) {
        return new ApiResponse(404, {}, Msg.COMPANY_USER_NOT_FOUND);
      }

      if (user.companyId !== companyId) {
        return new ApiResponse(403, {}, Msg.UNAUTHORIZED);
      }

      return new ApiResponse(
        200,
        {
          ...user,
          fullName:
            user.fullName ||
            `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        },
        Msg.DATA_FETCHED,
      );
    } catch (error) {
      console.error('Error fetching company user by id:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async updateCompanyUser(dto: UpdateCompanyUserDto, currentUserOrId: any) {
    try {
      if (!isValidObjectId(dto.id)) {
        return new ApiResponse(400, {}, Msg.INVALID_INPUT);
      }

      const companyId = await this.resolveCompanyId(currentUserOrId);
      if (!companyId) {
        return new ApiResponse(400, {}, Msg.COMPANY_CONTEXT_REQUIRED);
      }

      const user = await this.companyUserModel.findById(dto.id);
      if (!user) {
        return new ApiResponse(404, {}, Msg.COMPANY_USER_NOT_FOUND);
      }

      if (user.companyId !== companyId) {
        return new ApiResponse(403, {}, Msg.UNAUTHORIZED);
      }

      if (dto.fullName) {
        user.fullName = dto.fullName.trim();
        const nameParts = dto.fullName.trim().split(/\s+/);
        user.firstName = nameParts[0] || user.firstName;
        user.lastName = nameParts.slice(1).join(' ') || '';
      }

      if (dto.email) {
        const normalizedEmail = dto.email.toLowerCase().trim();
        if (normalizedEmail !== user.email) {
          const emailExists =
            (await this.companyUserModel.findOne({ email: normalizedEmail })) ||
            (await this.userModel.findOne({ email: normalizedEmail }));
          if (emailExists) {
            return new ApiResponse(400, {}, Msg.USER_EXISTS_EMAIL);
          }
          user.email = normalizedEmail;
        }
      }

      if (dto.role) {
        let role = dto.role.toUpperCase().replace(/\s+/g, '_');
        if (role === 'ACCOUNTING') role = 'ACCOUNTANT';
        user.role = role as UserRole;
      }

      if (dto.status !== undefined) {
        user.status = dto.status;
        user.isActive = dto.status === 'Active';
      }

      if (dto.phoneNumber !== undefined) {
        user.phoneNumber = dto.phoneNumber ? dto.phoneNumber.trim() : undefined;
      }

      await user.save();

      const responseData = {
        _id: user._id,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        status: user.status,
        companyId: user.companyId,
      };

      return new ApiResponse(200, responseData, Msg.COMPANY_USER_UPDATED);
    } catch (error) {
      console.error('Error updating company user:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async updateCompanyUserStatus(
    dto: UpdateCompanyUserStatusDto,
    currentUserOrId: any,
  ) {
    try {
      const companyId = await this.resolveCompanyId(currentUserOrId);
      if (!companyId) {
        return new ApiResponse(400, {}, Msg.COMPANY_CONTEXT_REQUIRED);
      }

      const user = await this.companyUserModel.findById(dto.id);
      if (!user) {
        return new ApiResponse(404, {}, Msg.COMPANY_USER_NOT_FOUND);
      }

      if (user.companyId !== companyId) {
        return new ApiResponse(403, {}, Msg.UNAUTHORIZED);
      }

      user.status = dto.status;
      user.isActive = dto.status === 'Active';
      await user.save();

      return new ApiResponse(
        200,
        {
          _id: user._id,
          status: user.status,
        },
        Msg.COMPANY_USER_STATUS_UPDATED,
      );
    } catch (error) {
      console.error('Error updating company user status:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async resendCredentials(id: string, currentUserOrId: any) {
    try {
      if (!isValidObjectId(id)) {
        return new ApiResponse(400, {}, Msg.INVALID_INPUT);
      }

      const companyId = await this.resolveCompanyId(currentUserOrId);
      if (!companyId) {
        return new ApiResponse(400, {}, Msg.COMPANY_CONTEXT_REQUIRED);
      }

      const user = await this.companyUserModel.findById(id);
      if (!user) {
        return new ApiResponse(404, {}, Msg.COMPANY_USER_NOT_FOUND);
      }

      if (user.companyId !== companyId) {
        return new ApiResponse(403, {}, Msg.UNAUTHORIZED);
      }

      const company = isValidObjectId(user.companyId)
        ? await this.companyModel.findById(user.companyId)
        : await this.companyModel.findOne({ companyId: user.companyId });

      const companyName = company
        ? company.displayName || company.legalName
        : 'Your Company';

      const tempPassword = generateRandomPassword(8);
      user.password = tempPassword;
      await user.save();

      if (!user.email) {
        return new ApiResponse(400, {}, Msg.INVALID_EMAIL_ADDRESS);
      }

      const loginUrl =
        process.env.FRONTEND_URL || 'https://admin.carline.com/login';
      const emailHtml = getTeamMemberWelcomeEmailTemplate(
        user.fullName ||
          `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        companyName,
        user.email,
        user.role,
        tempPassword,
        loginUrl,
      );

      await this.mailService.sendEmail(
        user.email,
        `New Credentials for ${companyName} - Carline Taxi Dispatch`,
        `Your new temporary password is: ${tempPassword}`,
        emailHtml,
      );

      return new ApiResponse(200, {}, Msg.CREDENTIALS_RESENT);
    } catch (error) {
      console.error('Error resending credentials:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async deleteCompanyUser(id: string, currentUserOrId: any) {
    try {
      if (!isValidObjectId(id)) {
        return new ApiResponse(400, {}, Msg.INVALID_INPUT);
      }

      const companyId = await this.resolveCompanyId(currentUserOrId);
      if (!companyId) {
        return new ApiResponse(400, {}, Msg.COMPANY_CONTEXT_REQUIRED);
      }

      const user = await this.companyUserModel.findById(id);
      if (!user) {
        return new ApiResponse(404, {}, Msg.COMPANY_USER_NOT_FOUND);
      }

      if (user.companyId !== companyId) {
        return new ApiResponse(403, {}, Msg.UNAUTHORIZED);
      }

      await this.companyUserModel.findByIdAndDelete(id);

      return new ApiResponse(200, {}, Msg.COMPANY_USER_DELETED);
    } catch (error) {
      console.error('Error deleting company user:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }
}
