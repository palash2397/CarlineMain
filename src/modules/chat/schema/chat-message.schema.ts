import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type ChatMessageDocument = HydratedDocument<ChatMessage>;

@Schema({
  timestamps: true,
})
export class ChatMessage {
  @Prop({
    type: String,
    required: true,
    index: true,
  })
  rideId: string;

  @Prop({
    type: String,
    index: true,
  })
  ride: string;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  senderId: string;

  @Prop({
    type: String,
    index: true,
  })
  sender: string;

  @Prop({
    type: String,
    default: null,
    index: true,
  })
  receiverId?: string | null;

  @Prop({
    type: String,
    default: null,
  })
  receiver?: string | null;

  @Prop({
    type: String,
    enum: ['DRIVER', 'PASSENGER', 'USER'],
    default: 'USER',
  })
  senderRole: string;

  @Prop({
    type: String,
    default: '',
    trim: true,
  })
  senderName: string;

  @Prop({
    type: String,
    default: null,
  })
  senderAvatar?: string | null;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  message: string;

  @Prop({
    type: Boolean,
    default: false,
  })
  isRead: boolean;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
