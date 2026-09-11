import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { SupportStatus } from 'src/common/enums/support/support.enum';

export type SupportDocument = HydratedDocument<Support>;

@Schema({ timestamps: true })
export class Support {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  user: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  message: string;

  @Prop({
    type: String,
    enum: Object.values(SupportStatus),
    default: SupportStatus.OPEN,
  })
  status: SupportStatus;
}

export const SupportSchema = SchemaFactory.createForClass(Support);
