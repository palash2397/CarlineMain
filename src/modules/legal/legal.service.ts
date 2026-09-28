import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';
import { LegalPageType } from 'src/common/enums/legal/legal-page-type.enum';
import { UserRole } from 'src/common/enums/user/role.enum';
import { Company, CompanyDocument } from '../super-admin/schema/company.schema';
import { Legal, LegalDocument } from './schema/legal.schema';
import { UpdateLegalPageDto } from './dto/update-legal-page.dto';

@Injectable()
export class LegalService {
  constructor(
    @InjectModel(Legal.name)
    private readonly legalModel: Model<LegalDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
  ) {}

  // A company admin and his staff always work on the company of their own
  // token. A superadmin may point to another company with companyId, and the
  // app side falls back to the only company of this deployment.
  private async resolveCompanyId(
    user: any,
    requestedCompanyId?: string,
  ): Promise<string | null> {
    const role = String(user?.roles || user?.role || '').toUpperCase();

    if (
      role === UserRole.SUPERADMIN ||
      role === UserRole.ADMIN ||
      role === 'SUPER_ADMIN'
    ) {
      if (requestedCompanyId) {
        return requestedCompanyId;
      }

      if (user?.companyId) {
        return user.companyId;
      }

      return this.firstCompanyId();
    }

    if (user?.companyId) {
      return user.companyId;
    }

    return this.firstCompanyId();
  }

  private async firstCompanyId(): Promise<string | null> {
    const company = await this.companyModel.findOne();
    return company ? company._id.toString() : null;
  }

  private defaultTitle(type: LegalPageType) {
    return type === LegalPageType.PRIVACY_POLICY
      ? 'Privacy Policy'
      : 'Terms and Conditions';
  }

  // An empty page is a valid state, because the company admin creates the
  // content later, so the app gets an empty body instead of an error.
  private pagePayload(page: any, companyId: string, type: LegalPageType) {
    return {
      id: page ? String(page._id) : null,
      companyId,
      type,
      title: page?.title || this.defaultTitle(type),
      content: page?.content || '',
      isConfigured: Boolean(page?.content),
      updatedBy: page?.updatedBy || null,
      createdAt: page?.createdAt || null,
      updatedAt: page?.updatedAt || null,
    };
  }

  async getPage(user: any, type: LegalPageType, companyIdQuery?: string) {
    try {
      const companyId = await this.resolveCompanyId(user, companyIdQuery);

      if (!companyId) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      const page = await this.legalModel.findOne({ companyId, type });

      return new ApiResponse(
        200,
        this.pagePayload(page, companyId, type),
        page?.content ? Msg.LEGAL_PAGE_FETCHED : Msg.LEGAL_PAGE_NOT_CONFIGURED,
      );
    } catch (error) {
      console.error('Error while fetching legal page:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async savePage(user: any, type: LegalPageType, dto: UpdateLegalPageDto) {
    try {
      const companyId = await this.resolveCompanyId(user, dto.companyId);

      if (!companyId) {
        return new ApiResponse(400, {}, Msg.COMPANY_CONTEXT_REQUIRED);
      }

      const existing = await this.legalModel.findOne({ companyId, type });

      const page = await this.legalModel.findOneAndUpdate(
        { companyId, type },
        {
          $set: {
            title: dto.title?.trim() || this.defaultTitle(type),
            content: dto.content,
            updatedBy: user?.id ? String(user.id) : null,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      return new ApiResponse(
        existing ? 200 : 201,
        this.pagePayload(page, companyId, type),
        existing ? Msg.LEGAL_PAGE_UPDATED : Msg.LEGAL_PAGE_CREATED,
      );
    } catch (error) {
      console.error('Error while saving legal page:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }
}
