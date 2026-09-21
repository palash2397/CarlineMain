import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { DriverStatus } from 'src/common/enums/driver/status-enum';
import { UserRole } from 'src/common/enums/user/role.enum';

export type DriverDocument = HydratedDocument<Driver>;

@Schema({
  timestamps: true,
})
export class Driver {
  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  fullName: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  dateOfBirth: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  gender: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    index: true,
  })
  phoneNumber: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  email: string;

  @Prop({
    type: String,
    default: null,
    index: true,
  })
  companyId?: string | null;

  // ==========================================
  // Step 2: Driving Credentials & Service Area
  // ==========================================
  @Prop({
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  })
  licenseNumber: string;

  @Prop({
    type: String,
    trim: true,
    default: null,
  })
  licenseClass?: string | null;

  @Prop({
    type: String,
    trim: true,
    default: null,
  })
  issueDate?: string | null;

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  expiryDate: string;

  @Prop({
    type: String,
    trim: true,
    default: null,
  })
  employmentType?: string | null;

  @Prop({
    type: String,
    trim: true,
    default: null,
  })
  preferredServiceArea?: string | null;

  // ==========================================
  // Step 3: Vehicle Specifications
  // ==========================================
  @Prop({
    type: String,
    trim: true,
    default: null,
  })
  vehicleTypeId?: string | null;

  @Prop({
    type: String,
    trim: true,
    default: null,
  })
  vehicleType?: string | null;

  @Prop({
    type: String,
    trim: true,
    default: null,
  })
  fuelType?: string | null;

  @Prop({
    type: String,
    trim: true,
    default: null,
  })
  transmission?: string | null;

  @Prop({
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  })
  vehicleRegistrationNumber: string;

  @Prop({
    type: String,
    trim: true,
    default: null,
  })
  make?: string | null;

  @Prop({
    type: String,
    trim: true,
    default: null,
  })
  modelAndYear?: string | null;

  // ==========================================
  // Step 4: Document Verification & Terms
  // ==========================================
  @Prop({
    type: String,
    trim: true,
    default: null,
  })
  governmentIdUrl?: string | null;

  @Prop({
    type: String,
    trim: true,
    default: null,
  })
  licenseCopyUrl?: string | null;

  @Prop({
    type: String,
    trim: true,
    default: null,
  })
  vehicleRegistrationDocUrl?: string | null;

  @Prop({
    type: String,
    trim: true,
    default: null,
  })
  insuranceProofUrl?: string | null;

  @Prop({
    type: Boolean,
    required: true,
    default: false,
  })
  termsAccepted: boolean;

  // ==========================================
  // Account, Status & System Fields
  // ==========================================
  @Prop({
    type: String,
    trim: true,
    default: null,
    select: false,
  })
  password?: string | null;

  @Prop({
    type: String,
    enum: DriverStatus,
    default: DriverStatus.PENDING_APPROVAL,
  })
  status: DriverStatus;

  @Prop({
    type: String,
    enum: UserRole,
    default: UserRole.DRIVER,
  })
  role: UserRole;

  @Prop({
    type: String,
    default: null,
  })
  avatar?: string | null;

  @Prop({
    type: Boolean,
    default: false,
  })
  isVerified: boolean;

  @Prop({
    type: Boolean,
    default: false,
  })
  isActive: boolean;

  @Prop({
    type: String,
    default: null,
  })
  rejectionReason?: string | null;

  @Prop({
    type: String,
    default: null,
  })
  otp?: string | null;

  @Prop({
    type: Date,
    default: null,
  })
  otpExpireAt?: Date | null;

  @Prop({
    type: Boolean,
    default: false,
  })
  isPasswordReset: boolean;

  // ==========================================
  // Duty & live location (used by booking + tracking)
  // ==========================================
  @Prop({ type: Boolean, default: false, index: true })
  isOnline?: boolean;

  @Prop({ type: Number, default: null })
  currentLatitude?: number | null;

  @Prop({ type: Number, default: null })
  currentLongitude?: number | null;

  @Prop({ type: Date, default: null })
  lastLocationAt?: Date | null;

  @Prop({ type: Number, default: null })
  rating?: number | null;
}

export const DriverSchema = SchemaFactory.createForClass(Driver);

DriverSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
});
