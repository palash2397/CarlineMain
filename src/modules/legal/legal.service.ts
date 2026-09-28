import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';
import {
  LegalPageScope,
  LegalPageType,
} from 'src/common/enums/legal/legal-page-type.enum';
import { UserRole } from 'src/common/enums/user/role.enum';
import { Legal, LegalDocument } from './schema/legal.schema';
import { UpdateLegalPageDto } from './dto/update-legal-page.dto';

@Injectable()
export class LegalService {
  constructor(
    @InjectModel(Legal.name)
    private readonly legalModel: Model<LegalDocument>,
  ) {}

  // A company admin and his staff always work on the company of their own
  // token. A superadmin may point to any company with companyId, and he writes
  // the default page of the deployment when he does not name one.
  private resolveCompanyScope(
    user: any,
    requestedCompanyId?: string,
  ): { companyId: string | null; isSuperadmin: boolean } {
    const role = String(user?.roles || user?.role || '').toUpperCase();
    const isSuperadmin =
      role === UserRole.SUPERADMIN ||
      role === UserRole.ADMIN ||
      role === 'SUPER_ADMIN';

    if (isSuperadmin) {
      return {
        companyId: requestedCompanyId || user?.companyId || null,
        isSuperadmin,
      };
    }

    return { companyId: user?.companyId || null, isSuperadmin };
  }

  private findPage(companyId: string | null, type: LegalPageType) {
    return this.legalModel.findOne({ companyId: companyId || null, type });
  }

  private defaultTitle(type: LegalPageType) {
    return type === LegalPageType.PRIVACY_POLICY
      ? 'Privacy Policy'
      : 'Terms and Conditions';
  }

  // An empty page is a valid state, because the company admin creates the
  // content later, so the app gets an empty body instead of an error.
  private pagePayload(
    page: any,
    companyId: string | null,
    type: LegalPageType,
    scope: LegalPageScope,
  ) {
    return {
      id: page ? String(page._id) : null,
      companyId,
      scope,
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
      const { companyId } = this.resolveCompanyScope(user, companyIdQuery);

      // The company the caller belongs to answers first. A user without a
      // company, or a company that did not create the page yet, gets the
      // default page written by the superadmin.
      const companyPage = companyId
        ? await this.findPage(companyId, type)
        : null;

      if (companyPage?.content) {
        return new ApiResponse(
          200,
          this.pagePayload(companyPage, companyId, type, 'COMPANY'),
          Msg.LEGAL_PAGE_FETCHED,
        );
      }

      const defaultPage = await this.findPage(null, type);

      if (defaultPage?.content) {
        return new ApiResponse(
          200,
          this.pagePayload(defaultPage, companyId, type, 'GLOBAL'),
          Msg.LEGAL_PAGE_FETCHED,
        );
      }

      return new ApiResponse(
        200,
        this.pagePayload(null, companyId, type, 'NONE'),
        Msg.LEGAL_PAGE_NOT_CONFIGURED,
      );
    } catch (error) {
      console.error('Error while fetching legal page:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async savePage(user: any, type: LegalPageType, dto: UpdateLegalPageDto) {
    try {
      const { companyId, isSuperadmin } = this.resolveCompanyScope(
        user,
        dto.companyId,
      );

      // A company admin without a company in his token has no page of his own,
      // and he must not write the default page of the deployment either.
      if (!companyId && !isSuperadmin) {
        return new ApiResponse(400, {}, Msg.COMPANY_CONTEXT_REQUIRED);
      }

      const scope: LegalPageScope = companyId ? 'COMPANY' : 'GLOBAL';
      const existing = await this.findPage(companyId, type);

      const page = await this.legalModel.findOneAndUpdate(
        { companyId: companyId || null, type },
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
        this.pagePayload(page, companyId, type, scope),
        existing ? Msg.LEGAL_PAGE_UPDATED : Msg.LEGAL_PAGE_CREATED,
      );
    } catch (error) {
      console.error('Error while saving legal page:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }
}
