import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PricingDocument = Pricing & Document;

@Schema({ _id: false })
export class FareRules {
  @Prop({ type: Number, default: 4.5, min: 0 })
  baseFare: number;

  @Prop({ type: Number, default: 7.5, min: 0 })
  minimumFare: number;

  @Prop({ type: Number, default: 1.8, min: 0 })
  perKmRate: number;

  @Prop({ type: Number, default: 0.4, min: 0 })
  perMinuteRate: number;
}

export const FareRulesSchema = SchemaFactory.createForClass(FareRules);

@Schema({ timestamps: true })
export class ZonePricingRule {
  _id?: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  zoneName: string;

  @Prop({ type: Number, default: 0, min: 0 })
  baseFareSurcharge: number;

  @Prop({ type: Number, default: 1.0, min: 0.1 })
  multiplier: number;

  @Prop({ type: String, enum: ['Active', 'Inactive'], default: 'Active' })
  status: string;
}

export const ZonePricingRuleSchema =
  SchemaFactory.createForClass(ZonePricingRule);

@Schema({ _id: false })
export class WaitingCharges {
  @Prop({ type: Number, default: 5, min: 0 })
  gracePeriodMinutes: number;

  @Prop({ type: Number, default: 0.3, min: 0 })
  waitingChargePerMinute: number;
}

export const WaitingChargesSchema =
  SchemaFactory.createForClass(WaitingCharges);

@Schema({ timestamps: true })
export class Pricing {
  @Prop({ type: String, required: true, unique: true, index: true })
  companyId: string;

  @Prop({ type: FareRulesSchema, default: () => ({}) })
  fareRules: FareRules;

  @Prop({ type: [ZonePricingRuleSchema], default: [] })
  zonePricing: ZonePricingRule[];

  @Prop({ type: WaitingChargesSchema, default: () => ({}) })
  waitingCharges: WaitingCharges;

  @Prop({ type: String, default: null })
  updatedBy?: string;
}

export const PricingSchema = SchemaFactory.createForClass(Pricing);
