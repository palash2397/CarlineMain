import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CustomerDocument = Customer & Document;

@Schema({ timestamps: true })
export class Customer {
  @Prop({ type: Number })
  customerId: number;

  @Prop()
  fullName: string;

  @Prop()
  email: string;

  @Prop()
  address: string;

  @Prop()
  fullAddress: string;

  @Prop()
  autoEmail: string;

  @Prop()
  accountNumber: string;

  @Prop()
  mobileNumber: string;

  @Prop({ type: Number, default: 0 })
  credit: number;

  @Prop()
  createdBy: string;

  @Prop()
  createdOn: string;

  @Prop()
  totalTripsTaken: string;

  @Prop()
  totalTripsDropped: string;

  @Prop()
  usaepayCustomerId: string;

  @Prop()
  cardLast4: string;

  @Prop()
  cardBrand: string;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);
