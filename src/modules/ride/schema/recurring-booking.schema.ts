import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { PaymentMethod } from 'src/common/enums/ride/payment-method.enum';
import { RecurrenceFrequency } from 'src/common/enums/ride/recurrence-frequency.enum';
import { RecurringStatus } from 'src/common/enums/ride/recurring-status.enum';

import type { RideLocation } from './ride.schema';

export type RecurringBookingDocument = HydratedDocument<RecurringBooking>;

// Booking template of a repeating ride (daily office run, weekly trip...).
// The series itself is never a ride: on every pickup the scheduler creates a
// normal ride that points back with its recurringId, so tracking, driver
// assignment, cancel and history stay exactly the same as a single ride.
@Schema({ timestamps: true })
export class RecurringBooking {
  @Prop({ type: String, required: true, index: true })
  user: string;

  @Prop({ type: String, default: null, index: true })
  companyId?: string | null;

  @Prop({ type: String, required: true })
  vehicleTypeId: string;

  @Prop({ type: String, default: null })
  vehicleTypeName?: string | null;

  @Prop({ type: Object, required: true })
  pickup: RideLocation;

  @Prop({ type: Object, required: true })
  dropoff: RideLocation;

  // How the series repeats. DAILY runs every day, WEEKLY uses daysOfWeek,
  // MONTHLY uses daysOfMonth.
  @Prop({
    type: String,
    enum: RecurrenceFrequency,
    default: RecurrenceFrequency.WEEKLY,
  })
  frequency: RecurrenceFrequency;

  // 0 = Sunday ... 6 = Saturday, used by a WEEKLY series.
  @Prop({ type: [Number], default: [] })
  daysOfWeek: number[];

  // Days of the month (1 - 31), used by a MONTHLY series. A day a month does
  // not have (31 in February) simply has no pickup.
  @Prop({ type: [Number], default: [] })
  daysOfMonth: number[];

  // Pickup time of the day in 24 hour HH:mm format.
  @Prop({ type: String, required: true })
  pickupTime: string;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, default: null })
  endDate?: Date | null;

  @Prop({ type: Number, default: 1 })
  passengerCount: number;

  @Prop({ type: String, enum: PaymentMethod, default: PaymentMethod.CASH })
  paymentMethod: PaymentMethod;

  @Prop({ type: String, default: null })
  notes?: string | null;

  @Prop({ type: String, default: null })
  promoCode?: string | null;

  @Prop({
    type: String,
    enum: RecurringStatus,
    default: RecurringStatus.ACTIVE,
  })
  status: RecurringStatus;

  // Pickup of the next ride the scheduler still has to create.
  @Prop({ type: Date, default: null })
  nextOccurrenceAt?: Date | null;

  @Prop({ type: Number, default: 0 })
  ridesCreated: number;

  @Prop({ type: Date, default: null })
  lastRideAt?: Date | null;

  @Prop({ type: String, default: null })
  cancelReason?: string | null;

  @Prop({ type: Date, default: null })
  cancelledAt?: Date | null;
}

export const RecurringBookingSchema =
  SchemaFactory.createForClass(RecurringBooking);

RecurringBookingSchema.index({ user: 1, createdAt: -1 });
RecurringBookingSchema.index({ status: 1, nextOccurrenceAt: 1 });
