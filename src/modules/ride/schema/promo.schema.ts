import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { PromoType } from 'src/common/enums/ride/promo-type.enum';

export type PromoDocument = HydratedDocument<Promo>;

@Schema({ timestamps: true })
export class Promo {
  @Prop({
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
  })
  code: string;

  @Prop({ type: String, trim: true, default: null })
  title?: string | null;

  @Prop({ type: String, enum: PromoType, default: PromoType.PERCENT })
  type: PromoType;

  @Prop({ type: Number, required: true, min: 0 })
  value: number;

  @Prop({ type: Number, default: null })
  maxDiscount?: number | null;

  @Prop({ type: Number, default: 0 })
  minFare: number;

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  expiresAt?: Date | null;

  @Prop({ type: Number, default: null })
  usageLimit?: number | null;

  @Prop({ type: Number, default: 0 })
  usedCount: number;
}

export const PromoSchema = SchemaFactory.createForClass(Promo);
