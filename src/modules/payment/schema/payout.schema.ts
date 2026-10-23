import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PayoutStatus } from 'src/common/enums/payment/payout-status.enum';

export type PayoutDocument = HydratedDocument<Payout>;

export class BankDetails {
  @Prop({ type: String, required: true })
  accountNumber: string;

  @Prop({ type: String, required: true })
  routingNumber: string; // or IFSC code

  @Prop({ type: String, required: true })
  bankName: string;

  @Prop({ type: String, required: true })
  accountHolderName: string;
}

@Schema({ timestamps: true })
export class Payout {
  /** Driver who requested the payout */
  @Prop({ type: String, required: true, index: true })
  driverId: string;

  @Prop({ type: String, default: null })
  driverName?: string | null;

  /** Associated company ID of the driver */
  @Prop({ type: String, default: null, index: true })
  companyId?: string | null;

  /** Requested withdrawal amount */
  @Prop({ type: Number, required: true, min: 1 })
  amount: number;

  @Prop({ type: String, default: 'USD' })
  currency: string;

  /** Payout request status */
  @Prop({
    type: String,
    enum: PayoutStatus,
    default: PayoutStatus.PENDING,
    index: true,
  })
  status: PayoutStatus;

  /** Driver bank account details for transfer */
  @Prop({ type: BankDetails, required: true })
  bankDetails: BankDetails;

  @Prop({ type: Date, default: Date.now })
  requestedAt: Date;

  @Prop({ type: Date, default: null })
  processedAt?: Date | null;

  /** Admin / Company User who approved or rejected */
  @Prop({ type: String, default: null })
  processedBy?: string | null;

  /** Bank transfer / transaction reference upon approval */
  @Prop({ type: String, default: null })
  transferReference?: string | null;

  /** Linked Outflow PaymentTransaction ID once approved */
  @Prop({ type: String, default: null })
  transactionId?: string | null;

  /** Driver notes */
  @Prop({ type: String, default: null })
  notes?: string | null;

  /** Rejection reason if rejected */
  @Prop({ type: String, default: null })
  rejectionReason?: string | null;
}

export const PayoutSchema = SchemaFactory.createForClass(Payout);
