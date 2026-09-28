import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';
import { LegalPageType } from 'src/common/enums/legal/legal-page-type.enum';
import { Legal, LegalDocument } from './schema/legal.schema';
import { UpdateLegalPageDto } from './dto/update-legal-page.dto';

@Injectable()
export class LegalService {
  constructor(
    @InjectModel(Legal.name)
    private readonly legalModel: Model<LegalDocument>,
  ) {}

  private defaultTitle(type: LegalPageType) {
    return type === LegalPageType.PRIVACY_POLICY
      ? 'Privacy Policy'
      : 'Terms and Conditions';
  }

  // An empty page is a valid state, because the superadmin creates the content
  // later, so the app gets an empty body instead of an error.
  private pagePayload(page: any, type: LegalPageType) {
    return {
      id: page ? String(page._id) : null,
      type,
      title: page?.title || this.defaultTitle(type),
      content: page?.content || '',
      isConfigured: Boolean(page?.content),
      updatedBy: page?.updatedBy || null,
      createdAt: page?.createdAt || null,
      updatedAt: page?.updatedAt || null,
    };
  }

  async getPage(type: LegalPageType) {
    try {
      const page = await this.legalModel.findOne({ type });

      return new ApiResponse(
        200,
        this.pagePayload(page, type),
        page?.content ? Msg.LEGAL_PAGE_FETCHED : Msg.LEGAL_PAGE_NOT_CONFIGURED,
      );
    } catch (error) {
      console.error('Error while fetching legal page:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async savePage(user: any, type: LegalPageType, dto: UpdateLegalPageDto) {
    try {
      const existing = await this.legalModel.findOne({ type });

      const page = await this.legalModel.findOneAndUpdate(
        { type },
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
        this.pagePayload(page, type),
        existing ? Msg.LEGAL_PAGE_UPDATED : Msg.LEGAL_PAGE_CREATED,
      );
    } catch (error) {
      console.error('Error while saving legal page:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }
}
