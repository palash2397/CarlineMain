import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VehicleTypeDocument = VehicleType & Document;

@Schema({ timestamps: true })
export class VehicleType {
  @Prop({ type: String, required: true, trim: true, unique: true, index: true })
  name: string; // e.g. "Sedan Comfort", "SUV 6-Seater", "Eco EV Green", "VIP Executive"

  @Prop({ type: Number, required: true, min: 1, default: 4 })
  seats: number; // e.g. 4, 6

  @Prop({ type: String, trim: true, default: null })
  badge?: string; // e.g. "POPULAR", "ECO", "VIP" or null

  @Prop({ type: String, trim: true, default: null })
  etaText?: string; // e.g. "3-5 min", "4-6 min"

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  basePrice: number; // e.g. 18.30

  @Prop({ type: Number, min: 0, default: null })
  perKmRate?: number;

  @Prop({ type: Number, min: 0, default: null })
  perMinuteRate?: number;

  @Prop({ type: String, trim: true, default: null })
  image?: string; // Vehicle image URL

  @Prop({ type: String, trim: true, default: null })
  description?: string;

  @Prop({ type: String, enum: ['Active', 'Inactive'], default: 'Active', index: true })
  status: string;

  @Prop({ type: Number, default: 0 })
  sortOrder: number;

  @Prop({ type: String, default: null })
  createdBy?: string;
}

export const VehicleTypeSchema = SchemaFactory.createForClass(VehicleType);
