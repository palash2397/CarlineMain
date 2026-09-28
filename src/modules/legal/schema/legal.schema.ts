import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { LegalPageType } from 'src/common/enums/legal/legal-page-type.enum';

export type LegalDocument = HydratedDocument<Legal>;

// The privacy policy and the terms and conditions of the deployment. A
// superadmin writes them and every driver, passenger and staff member reads
// the same page, there is one page per type.
@Schema({ timestamps: true })
export class Legal {
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

  // Banner image of the page, for example on top of the screen of the app.
  @Prop({
    type: String,
    default: null,
    trim: true,
  })
  image?: string;

  @Prop({
    type: String,
    default: null,
  })
  updatedBy?: string;
}

export const LegalSchema = SchemaFactory.createForClass(Legal);

// There is only one page of a given type, so the update can upsert it.
LegalSchema.index({ type: 1 }, { unique: true });
