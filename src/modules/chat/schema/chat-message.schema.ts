import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { User } from 'src/modules/user/schema/user.schema';
// import { MessageType } from 'src/common/enums/chat/messageType';

export type ChatMessageDocument = HydratedDocument<ChatMessage>;

@Schema({
  timestamps: true,
})
export class ChatMessage {
  // @Prop({
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: Ride.name,
  //   required: true,
  // })
  // ride: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  sender: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  receiver: mongoose.Types.ObjectId;

  @Prop({
    required: true,
    trim: true,
  })
  message: string;

  // @Prop({
  //   enum: MessageType,
  //   default: MessageType.TEXT,
  // })
  // messageType: MessageType;

  @Prop({
    default: false,
  })
  isRead: boolean;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
