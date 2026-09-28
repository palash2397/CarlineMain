import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { LegalPageType } from 'src/common/enums/legal/legal-page-type.enum';

export type LegalDocument = HydratedDocument<Legal>;

// One document per company and page type. A company admin creates his own
// pages, a superadmin can later update the pages of any company.
@Schema({ timestamps: true })
export class Legal {
  @Prop({
    type: String,
    required: true,
    trim: true,
    index: true,
  })
  companyId: string;

  @Prop({
    type: String,
    enum: LegalPageType,
    required: true,
  })
  type: LegalPageType;

  @Prop({
    type: String,
    default: null,
    trim: true,
  })
  title?: string;

  @Prop({
    type: String,
    default: '',
  })
  content: string;

  @Prop({
    type: String,
    default: null,
  })
  updatedBy?: string;
}

export const LegalSchema = SchemaFactory.createForClass(Legal);

// A company can keep only one page of a given type, so the update can upsert it.
LegalSchema.index({ companyId: 1, type: 1 }, { unique: true });
