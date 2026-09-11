import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FaqDocument = HydratedDocument<Faq>;

@Schema({ timestamps: true })
export class Faq {
  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  question: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  answer: string;
}

export const FaqSchema = SchemaFactory.createForClass(Faq);
