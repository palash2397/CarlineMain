import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { CancelledBy } from 'src/common/enums/ride/cancelled-by.enum';
import { PaymentMethod } from 'src/common/enums/ride/payment-method.enum';
import { PaymentStatus } from 'src/common/enums/ride/payment-status.enum';
import { RideStatus } from 'src/common/enums/ride/ride-status.enum';
import { RideType } from 'src/common/enums/ride/ride-type.enum';

export type RideDocument = HydratedDocument<Ride>;

export interface RideLocation {
  address?: string | null;
  latitude: number;
  longitude: number;
}

export interface RideFareBreakdown {
  basePrice: number;
  perKmRate: number;
  perMinuteRate: number;
  distanceKm: number;
  distanceMiles: number;
  durationMinutes: number;
  distanceRate: number;
  timeRate: number;
  subTotal: number;
  discount: number;
  taxAndFees: number;
  totalFare: number;
  payableFare: number;
  currency: string;
}

@Schema({ timestamps: true })
export class Ride {
  @Prop({ type: String, required: true, index: true })
  user: string;

  @Prop({ type: String, default: null, index: true })
  driver?: string | null;

  @Prop({ type: String, default: null, index: true })
  companyId?: string | null;

  @Prop({ type: String, required: true })
  vehicleTypeId: string;

  @Prop({ type: String, default: null })
  vehicleTypeName?: string | null;

  @Prop({
    type: String,
    enum: RideStatus,
    default: RideStatus.SEARCHING_DRIVER,
    index: true,
  })
  status: RideStatus;

  @Prop({ type: Object, required: true })
  pickup: RideLocation;

  @Prop({ type: Object, required: true })
  dropoff: RideLocation;

  @Prop({ type: Number, default: 0 })
  distanceKm: number;

  @Prop({ type: Number, default: 0 })
  durationMinutes: number;

  @Prop({ type: Number, default: 0 })
  etaMinutes: number;

  @Prop({ type: String, default: null })
  routeSource?: string | null;

  @Prop({ type: Object, default: {} })
  fare: RideFareBreakdown;

  @Prop({ type: Number, default: 0 })
  totalFare: number;

  @Prop({ type: Number, default: 0 })
  payableFare: number;

  @Prop({ type: String, default: null })
  promoCode?: string | null;

  @Prop({ type: Number, default: 0 })
  discount: number;

  @Prop({ type: String, enum: RideType, default: RideType.INSTANT })
  rideType: RideType;

  @Prop({ type: Date, default: null })
  scheduledAt?: Date | null;

  @Prop({ type: Number, default: 1 })
  passengerCount: number;

  @Prop({ type: String, enum: PaymentMethod, default: PaymentMethod.CASH })
  paymentMethod: PaymentMethod;

  @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @Prop({ type: Date, default: null })
  paymentCollectedAt?: Date | null;

  @Prop({ type: String, default: null })
  notes?: string | null;

  @Prop({ type: String, default: null })
  otp?: string | null;

  @Prop({ type: String, default: null })
  cancelReason?: string | null;

  @Prop({ type: String, enum: CancelledBy, default: null })
  cancelledBy?: CancelledBy | null;

  @Prop({ type: Date, default: null })
  cancelledAt?: Date | null;

  @Prop({ type: Date, default: null })
  driverAssignedAt?: Date | null;

  @Prop({ type: Date, default: null })
  startedAt?: Date | null;

  @Prop({ type: Date, default: null })
  completedAt?: Date | null;
}

export const RideSchema = SchemaFactory.createForClass(Ride);

RideSchema.index({ user: 1, createdAt: -1 });
RideSchema.index({ status: 1, createdAt: -1 });
