import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PaymentTransactionStatus } from 'src/common/enums/payment/payment-transaction-status.enum';
import { PaymentMethod } from 'src/common/enums/ride/payment-method.enum';

export type PaymentTransactionDocument = HydratedDocument<PaymentTransaction>;

export interface CommissionSnapshot {
  fareAmount: number;
  superAdminCommissionType: string;
  superAdminCommissionValue: number;
  superAdminCommissionAmount: number;
  companyCommissionType: string;
  companyCommissionValue: number;
  companyCommissionAmount: number;
  driverEarnings: number;
  companyEarnings: number;
  platformEarnings: number;
  isCustomDriverRate: boolean;
}

@Schema({ timestamps: true })
export class PaymentTransaction {
  /** Customer reference (string ID from Customer collection) */
  @Prop({ type: String, required: true, index: true })
  customerId: string;

  /** Ride reference */
  @Prop({ type: String, default: null, index: true })
  rideId?: string | null;

  /** Driver reference */
  @Prop({ type: String, default: null })
  driverId?: string | null;

  /** Company reference */
  @Prop({ type: String, default: null })
  companyId?: string | null;

  /** Total charge amount in dollars */
  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: String, enum: PaymentMethod, default: PaymentMethod.CARD })
  paymentMethod: PaymentMethod;

  @Prop({
    type: String,
    enum: PaymentTransactionStatus,
    default: PaymentTransactionStatus.PENDING,
    index: true,
  })
  status: PaymentTransactionStatus;

  /** USAePay transaction key (returned after charge) */
  @Prop({ type: String, default: null })
  usaepayTransactionKey?: string | null;

  /** USAePay numeric reference number (needed for refunds/voids) */
  @Prop({ type: String, default: null, index: true })
  refNum?: string | null;

  /** USAePay refund transaction key */
  @Prop({ type: String, default: null })
  usaepayRefundKey?: string | null;

  /** USAePay customer vault key */
  @Prop({ type: String, default: null })
  usaepayCustomerKey?: string | null;

  /** USAePay payment method key (saved card) */
  @Prop({ type: String, default: null })
  usaepayPayMethodKey?: string | null;

  /** Card last 4 digits (for display) */
  @Prop({ type: String, default: null })
  cardLast4?: string | null;

  /** Card brand e.g. Visa, Mastercard */
  @Prop({ type: String, default: null })
  cardBrand?: string | null;

  /** Refunded amount (partial or full) */
  @Prop({ type: Number, default: 0 })
  refundedAmount: number;

  /** Commission breakdown snapshot at time of transaction */
  @Prop({ type: Object, default: null })
  commissionSnapshot?: CommissionSnapshot | null;

  /** Error message if payment failed */
  @Prop({ type: String, default: null })
  errorMessage?: string | null;

  /** USAePay raw response (for debugging) */
  @Prop({ type: Object, default: null })
  rawResponse?: any | null;

  /** When payment was charged */
  @Prop({ type: Date, default: null })
  chargedAt?: Date | null;

  /** When refund was processed */
  @Prop({ type: Date, default: null })
  refundedAt?: Date | null;

  /** Human-readable description e.g. "Ride #XYZ payment" */
  @Prop({ type: String, default: null })
  description?: string | null;
}

export const PaymentTransactionSchema =
  SchemaFactory.createForClass(PaymentTransaction);

PaymentTransactionSchema.index({ customerId: 1, createdAt: -1 });
PaymentTransactionSchema.index({ status: 1, createdAt: -1 });
