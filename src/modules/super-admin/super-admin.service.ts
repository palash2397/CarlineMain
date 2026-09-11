import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';

import { User, UserDocument } from '../user/schema/user.schema';
import { Company, CompanyDocument } from './schema/company.schema';
import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';

import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

import { SuperAdminLoginDto } from './dto/super-admin-login.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanyStatusDto } from './dto/update-company-status.dto';
import { UserRole } from 'src/common/enums/user/role.enum';
import { MailService } from '../mail/mail.service';
import { getCompanyWelcomeEmailTemplate } from '../mail/template/company-welcome.template';
import { generateRandomPassword, deleteOldFile } from '../../helpers/index';

@Injectable()
export class SuperAdminService implements OnModuleInit {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    private readonly mailService: MailService,
  ) {}

  async onModuleInit() {
    await this.cleanupObsoleteIndexes();
    await this.seedSuperAdmin();
  }

  async cleanupObsoleteIndexes() {
    try {
      const indexes = await this.companyModel.collection.indexes();
      const hasOldEmailIndex = indexes.some((idx) => idx.name === 'email_1');
      if (hasOldEmailIndex) {
        await this.companyModel.collection.dropIndex('email_1');
        console.log('✅ Dropped obsolete index email_1 from companies collection');
      }
    } catch (error: any) {
      console.log('Note: Error checking/dropping company indexes:', error?.message);
    }
  }

  async seedSuperAdmin() {
    try {
      const email = 'superadmin@yopmail.com';
      const plainPassword = 'superadmin';

      let superAdmin = await this.userModel.findOne({ email });

      if (!superAdmin) {
        const phone = '8454441234';
        const existingPhoneUser = await this.userModel.findOne({
          phoneNumber: phone,
        });
        const finalPhone = existingPhoneUser
          ? `845444${Math.floor(1000 + Math.random() * 9000)}`
          : phone;

        superAdmin = new this.userModel({
          firstName: 'Super',
          lastName: 'Admin',
          email,
          phoneNumber: finalPhone,
          password: plainPassword,
          role: UserRole.SUPERADMIN,
          isVerified: true,
          isActive: true,
        });
        await superAdmin.save();
        console.log(
          `✅ Super Admin seeded successfully: ${email} (Password: ${plainPassword})`,
        );
      } else {
        let needsSave = false;

        if (superAdmin.role !== UserRole.SUPERADMIN) {
          superAdmin.role = UserRole.SUPERADMIN;
          needsSave = true;
        }
        if (!superAdmin.isVerified) {
          superAdmin.isVerified = true;
          needsSave = true;
        }
        if (!superAdmin.isActive) {
          superAdmin.isActive = true;
          needsSave = true;
        }

        const isMatch = await bcrypt.compare(
          plainPassword,
          superAdmin.password || '',
        );
        if (!isMatch) {
          superAdmin.password = plainPassword;
          needsSave = true;
        }

        if (needsSave) {
          await superAdmin.save();
          console.log(`✅ Super Admin verified & updated in DB: ${email}`);
        }
      }
    } catch (error) {
      console.log('Error while seeding super admin:', error);
    }
  }

  async login(dto: SuperAdminLoginDto) {
    try {
      const normalizedEmail = (dto.email || '').toLowerCase().trim();
      const user = await this.userModel.findOne({
        email: normalizedEmail,
      });

      if (!user) {
        return new ApiResponse(400, {}, Msg.INVALID_CREDENTIALS);
      }

      if (user.role !== UserRole.SUPERADMIN) {
        return new ApiResponse(
          403,
          {},
          'Access denied: Only Super Admin can access this portal',
        );
      }

      if (!user.isActive) {
        return new ApiResponse(400, {}, Msg.ACCOUNT_DEACTIVATED);
      }

      if (!user.isVerified) {
        return new ApiResponse(400, {}, Msg.USER_NOT_VERIFIED);
      }

      if (!user.password) {
        return new ApiResponse(400, {}, Msg.INVALID_CREDENTIALS);
      }

      const isPasswordValid = await bcrypt.compare(dto.password, user.password);

      if (!isPasswordValid) {
        return new ApiResponse(401, {}, Msg.INVALID_CREDENTIALS);
      }

      const token = jwt.sign(
        {
          id: user._id.toString(),
          roles: user.role,
          email: user.email,
        },
        process.env.JWT_SECRET || 'carline_secret_key',
        {
          expiresIn: '10d',
        },
      );

      const userData = {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        phoneNumber: user.phoneNumber,
        email: user.email,
        role: user.role,
        roles: user.role,
        avatar: user.avatar || null,
        token,
      };

      return new ApiResponse(
        200,
        {
          userData,
        },
        Msg.LOGIN_SUCCESS,
      );
    } catch (error) {
      console.log('Error while super admin login:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  private parseCompanyFormData(body: any, files?: any): any {
    let dto: any = { ...body };

    // Support payload sent inside a JSON string 'data'
    if (typeof body.data === 'string') {
      try {
        dto = { ...dto, ...JSON.parse(body.data) };
      } catch (e) {}
    }

    const jsonFields = [
      'address',
      'primaryContact',
      'billing',
      'branding',
      'documents',
    ];
    for (const field of jsonFields) {
      if (typeof dto[field] === 'string') {
        try {
          dto[field] = JSON.parse(dto[field]);
        } catch (e) {}
      }
    }

    // Assemble Address from flat fields or existing object
    const address = {
      streetAddress:
        dto.streetAddress !== undefined
          ? dto.streetAddress
          : dto.address?.streetAddress || '',
      city: dto.city !== undefined ? dto.city : dto.address?.city || '',
      state: dto.state !== undefined ? dto.state : dto.address?.state || '',
      zipCode:
        dto.zipCode !== undefined ? dto.zipCode : dto.address?.zipCode || '',
      country:
        dto.country !== undefined
          ? dto.country
          : dto.address?.country || 'India',
      timezone:
        dto.timezone !== undefined
          ? dto.timezone
          : dto.address?.timezone || 'IST (UTC+5:30)',
    };

    // Assemble Primary Contact from flat fields or existing object
    const primaryContact = {
      name:
        dto.primaryContactName !== undefined
          ? dto.primaryContactName
          : dto.contactName || dto.primaryContact?.name || '',
      email:
        dto.primaryContactEmail !== undefined
          ? dto.primaryContactEmail
          : dto.contactEmail || dto.email || dto.primaryContact?.email || '',
      phone:
        dto.primaryContactPhone !== undefined
          ? dto.primaryContactPhone
          : dto.contactPhone || dto.phone || dto.primaryContact?.phone || '',
    };

    // Assemble Billing from flat fields or existing object
    const billing = {
      contactName:
        dto.billingContactName !== undefined
          ? dto.billingContactName
          : dto.billing?.contactName || '',
      email:
        dto.billingEmail !== undefined
          ? dto.billingEmail
          : dto.billing?.email || '',
      phone:
        dto.billingPhone !== undefined
          ? dto.billingPhone
          : dto.billing?.phone || '',
      address:
        dto.billingAddress !== undefined
          ? dto.billingAddress
          : dto.billing?.address || '',
    };

    // Assemble Branding from flat fields or existing object
    const branding = {
      logo: dto.branding?.logo || '',
      brandColor:
        dto.brandColor !== undefined
          ? dto.brandColor
          : dto.branding?.brandColor || '#E05326',
      displayNameOverride:
        dto.displayNameOverride !== undefined
          ? dto.displayNameOverride
          : dto.branding?.displayNameOverride || '',
    };

    const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');

    // Process Logo File
    const logoFile = files?.logo?.[0] || files?.companyLogo?.[0];
    if (logoFile) {
      branding.logo = `${baseUrl}/api/v1/uploads/company/${logoFile.filename}`;
    }

    // Process Document Files (PDFs / Images)
    const docFiles = [
      ...(files?.documents || []),
      ...(files?.documentFiles || []),
      ...(files?.documentFile || []),
    ];
    let documents = dto.documents || [];
    if (typeof documents === 'string') {
      try {
        documents = JSON.parse(documents);
      } catch (e) {
        documents = [];
      }
    }
    if (!Array.isArray(documents)) {
      documents = [];
    }

    if (docFiles.length > 0) {
      docFiles.forEach((file: Express.Multer.File, index: number) => {
        const fileUrl = `${baseUrl}/api/v1/uploads/company/${file.filename}`;
        if (documents[index]) {
          documents[index].documentUrl = fileUrl;
          if (!documents[index].documentName) {
            documents[index].documentName =
              dto.documentName || file.originalname;
          }
          if (!documents[index].documentType) {
            documents[index].documentType =
              dto.documentType || 'Business License';
          }
        } else {
          documents.push({
            documentType: dto.documentType || 'Business License',
            documentName: dto.documentName || file.originalname,
            documentUrl: fileUrl,
            issueDate: dto.issueDate || new Date().toISOString().split('T')[0],
            expiryDate: dto.expiryDate || '',
            status: 'Approved',
          });
        }
      });
    }

    dto.address = address;
    dto.primaryContact = primaryContact;
    dto.billing = billing;
    dto.branding = branding;
    dto.documents = documents;

    return dto;
  }

  async createCompany(body: any, files?: any, adminUser?: any) {
    try {
      const dto = this.parseCompanyFormData(body, files);
      const normalizedCode = (dto.companyCode || '').toUpperCase().trim();
      const normalizedEmail = (dto.primaryContact?.email || '')
        .toLowerCase()
        .trim();

      const existingCompany = await this.companyModel.findOne({
        $or: [
          { companyCode: normalizedCode },
          { legalName: new RegExp(`^${dto.legalName.trim()}$`, 'i') },
        ],
      });

      if (existingCompany) {
        return new ApiResponse(409, {}, Msg.COMPANY_ALREADY_EXISTS);
      }

      // Generate sequence ID CMP-001, CMP-002...
      const lastCompany = await this.companyModel
        .findOne()
        .sort({ createdAt: -1 })
        .lean();

      let nextNum = 1;
      if (lastCompany && lastCompany.companyId) {
        const match = lastCompany.companyId.match(/\d+/);
        if (match) {
          nextNum = parseInt(match[0], 10) + 1;
        }
      }
      const formattedCompanyId = `CMP-${String(nextNum).padStart(3, '0')}`;

      const tempPassword = generateRandomPassword(8);

      const nameParts = dto.primaryContact.name.trim().split(' ');
      const firstName = nameParts[0] || 'Company';
      const lastName = nameParts.slice(1).join(' ') || 'Admin';

      let companyAdminUser = await this.userModel.findOne({
        email: normalizedEmail,
      });

      if (!companyAdminUser) {
        const phone = dto.primaryContact.phone.trim();
        const existingPhone = await this.userModel.findOne({
          phoneNumber: phone,
        });
        const finalPhone = existingPhone
          ? `${phone}-${Math.floor(100 + Math.random() * 900)}`
          : phone;

        companyAdminUser = new this.userModel({
          firstName,
          lastName,
          email: normalizedEmail,
          phoneNumber: finalPhone,
          password: tempPassword,
          role: UserRole.COMPANY_ADMIN,
          isVerified: true,
          isActive: true,
        });
        await companyAdminUser.save();
      } else {
        companyAdminUser.role = UserRole.COMPANY_ADMIN;
        companyAdminUser.isVerified = true;
        companyAdminUser.isActive = true;
        companyAdminUser.password = tempPassword;
        await companyAdminUser.save();
      }

      const newCompany = new this.companyModel({
        companyId: formattedCompanyId,
        legalName: dto.legalName.trim(),
        displayName: dto.displayName.trim(),
        companyCode: normalizedCode,
        registrationNumber: dto.registrationNumber || '',
        status: dto.status || 'Active',
        address: dto.address,
        primaryContact: {
          name: dto.primaryContact.name.trim(),
          email: normalizedEmail,
          phone: dto.primaryContact.phone.trim(),
        },
        billing: dto.billing || {},
        branding: dto.branding || {},
        documents: dto.documents || [],
        adminUserId: companyAdminUser._id.toString(),
        createdBy: adminUser?.email || 'SUPERADMIN',
      });

      await newCompany.save();

      companyAdminUser.companyId = newCompany._id.toString();
      await companyAdminUser.save();

      try {
        const loginUrl =
          process.env.FRONTEND_URL || 'https://admin.carline.com/login';
        const emailHtml = getCompanyWelcomeEmailTemplate(
          dto.primaryContact.name,
          dto.displayName,
          normalizedEmail,
          tempPassword,
          loginUrl,
        );

        await this.mailService.sendEmail(
          normalizedEmail,
          `Welcome to Carline - Your ${dto.displayName} Admin Credentials`,
          `Welcome to Carline! Your company ${dto.displayName} has been registered. Email: ${normalizedEmail}, Password: ${tempPassword}`,
          emailHtml,
        );
        console.log(`✅ Welcome credentials email sent to ${normalizedEmail}`);
      } catch (mailErr) {
        console.log(
          `⚠️ Failed to send welcome email to ${normalizedEmail}:`,
          mailErr,
        );
      }

      return new ApiResponse(
        201,
        {
          company: newCompany,
          adminAccount: {
            _id: companyAdminUser._id,
            email: companyAdminUser.email,
            role: companyAdminUser.role,
            temporaryPassword: tempPassword,
          },
        },
        Msg.COMPANY_CREATED,
      );
    } catch (error) {
      console.log('Error while creating company:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async getCompanies(query: any) {
    try {
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 10;
      const skip = (page - 1) * limit;

      const filter: any = {};

      if (query.search) {
        const searchRegex = new RegExp(query.search.trim(), 'i');
        filter.$or = [
          { companyId: searchRegex },
          { legalName: searchRegex },
          { displayName: searchRegex },
          { companyCode: searchRegex },
          { 'primaryContact.name': searchRegex },
          { 'primaryContact.email': searchRegex },
          { 'primaryContact.phone': searchRegex },
          { 'address.city': searchRegex },
          { 'address.state': searchRegex },
        ];
      }

      if (query.status && query.status !== 'All Statuses') {
        filter.status = query.status;
      }

      if (query.city && query.city !== 'All Cities') {
        filter['address.city'] = new RegExp(`^${query.city.trim()}$`, 'i');
      }

      const total = await this.companyModel.countDocuments(filter);
      const companies = await this.companyModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec();

      return new ApiResponse(
        200,
        {
          data: companies,
          total,
          page,
          limit,
        },
        Msg.COMPANIES_FETCHED,
      );
    } catch (error) {
      console.log('Error while fetching companies:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async getCompanyById(id: string) {
    try {
      let company: any = null;
      if (isValidObjectId(id)) {
        company = await this.companyModel.findById(id).lean();
      }
      if (!company) {
        company = await this.companyModel
          .findOne({
            $or: [{ companyId: id }, { companyCode: id.toUpperCase() }],
          })
          .lean();
      }

      if (!company) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      // Fetch primary admin user details
      let adminUser: any = null;
      if (company.adminUserId && isValidObjectId(company.adminUserId)) {
        adminUser = await this.userModel
          .findById(company.adminUserId)
          .select('-password -otp -otpExpireAt')
          .lean();
      }

      return new ApiResponse(
        200,
        {
          ...company,
          adminUser,
        },
        Msg.COMPANY_FETCHED,
      );
    } catch (error) {
      console.log('Error while fetching company by id:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async updateCompany(id: string, body: any, files?: any) {
    try {
      const dto = this.parseCompanyFormData(body, files);
      const company = await this.companyModel.findById(id);
      if (!company) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      if (dto.companyCode && dto.companyCode !== company.companyCode) {
        const codeCollision = await this.companyModel.findOne({
          companyCode: dto.companyCode.toUpperCase().trim(),
          _id: { $ne: company._id },
        });
        if (codeCollision) {
          return new ApiResponse(409, {}, Msg.COMPANY_ALREADY_EXISTS);
        }
        company.companyCode = dto.companyCode.toUpperCase().trim();
      }

      if (dto.legalName) company.legalName = dto.legalName.trim();
      if (dto.displayName) company.displayName = dto.displayName.trim();
      if (dto.registrationNumber !== undefined)
        company.registrationNumber = dto.registrationNumber;
      if (dto.status) company.status = dto.status;
      if (dto.address) company.address = { ...company.address, ...dto.address };
      if (dto.primaryContact)
        company.primaryContact = {
          ...company.primaryContact,
          ...dto.primaryContact,
        };
      if (dto.billing) company.billing = { ...company.billing, ...dto.billing };
      if (dto.branding) {
        if (
          dto.branding.logo &&
          company.branding?.logo &&
          dto.branding.logo !== company.branding.logo
        ) {
          const oldLogo = company.branding.logo.split('/').pop();
          if (oldLogo) deleteOldFile('company', oldLogo);
        }
        company.branding = { ...company.branding, ...dto.branding };
      }
      if (dto.documents) company.documents = dto.documents as any;

      await company.save();

      return new ApiResponse(200, company, Msg.COMPANY_UPDATED);
    } catch (error) {
      console.log('Error while updating company:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async updateCompanyStatus(dto: UpdateCompanyStatusDto) {
    try {
      const company = await this.companyModel.findById(dto.id);
      if (!company) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      company.status = dto.status;
      await company.save();

      // If suspended or inactive, de-activate admin user
      if (company.adminUserId) {
        await this.userModel.findByIdAndUpdate(company.adminUserId, {
          isActive: dto.status === 'Active',
        });
      }

      return new ApiResponse(
        200,
        {
          _id: company._id,
          companyId: company.companyId,
          status: company.status,
        },
        Msg.COMPANY_STATUS_UPDATED,
      );
    } catch (error) {
      console.log('Error while updating company status:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }
}
