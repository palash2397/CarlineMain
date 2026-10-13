import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BroadcastDocument = Broadcast & Document;

export enum BroadcastTarget {
  DRIVERS = 'DRIVERS',
  USERS = 'USERS',
  ALL = 'ALL',
}

@Schema({ timestamps: true })
export class Broadcast {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ enum: BroadcastTarget, default: BroadcastTarget.ALL })
  target: string;

  @Prop({ type: String, default: null })
  companyId?: string | null;

  @Prop({ type: String, default: null })
  senderId?: string | null;

  @Prop({ type: String, default: null })
  senderRole?: string | null;

  @Prop({ type: Object, default: {} })
  data?: Record<string, any>;

  @Prop({ type: Number, default: 0 })
  totalRecipients: number;

  @Prop({ type: Number, default: 0 })
  successCount: number;

  @Prop({ type: Number, default: 0 })
  failureCount: number;
}

export const BroadcastSchema = SchemaFactory.createForClass(Broadcast);
