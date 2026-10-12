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
  waitingMinutes?: number;
  waitingCharge?: number;
  extraCharges?: number;
  tollFee?: number;
  subTotal: number;
  discount: number;
  taxAndFees: number;
  totalFare: number;
  payableFare: number;
  currency: string;
}

export interface TripTimelineEvent {
  event: string;
  title: string;
  description: string;
  timestamp: Date;
  actor?: string | null;
  location?: RideLocation | null;
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

  // Set when this ride came out of a recurring booking series.
  @Prop({ type: String, default: null, index: true })
  recurringId?: string | null;

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

  @Prop({ type: String, default: null, index: true })
  dispatcherId?: string | null;

  @Prop({ type: Boolean, default: false })
  isDispatcherBooking?: boolean;

  // The driver currently being offered this ride in the 30-second window
  @Prop({ type: String, default: null, index: true })
  candidateDriverId?: string | null;

  // Drivers who previously timed out or declined this ride request
  @Prop({ type: [String], default: [] })
  attemptedDriverIds?: string[];

  // When the current driver's 30-second acceptance window expires
  @Prop({ type: Date, default: null })
  requestExpiresAt?: Date | null;

  // When driver reached the pickup location (Customer waiting starts)
  @Prop({ type: Date, default: null })
  driverArrivedAt?: Date | null;

  // When driver reached the final destination (Dropoff)
  @Prop({ type: Date, default: null })
  destinationReachedAt?: Date | null;

  @Prop({ type: Boolean, default: false })
  destinationReached?: boolean;

  // Pickup waiting time after grace period (in minutes) and accrued charge
  @Prop({ type: Number, default: 0 })
  pickupWaitingMinutes?: number;

  @Prop({ type: Number, default: 0 })
  waitingCharge?: number;

  // Structured lifecycle events history log
  @Prop({ type: [Object], default: [] })
  timeline?: TripTimelineEvent[];
}

export const RideSchema = SchemaFactory.createForClass(Ride);

RideSchema.index({ user: 1, createdAt: -1 });
RideSchema.index({ status: 1, createdAt: -1 });
