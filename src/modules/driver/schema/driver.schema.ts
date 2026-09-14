import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserRole } from 'src/common/enums/user/role.enum';
import { DriverStatus } from 'src/common/enums/driver/status-enum';

export type DriverDocument = Driver & Document;

@Schema({ _id: false })
export class DriverAddress {
  @Prop({ type: String, default: '' })
  streetAddress: string;

  @Prop({ type: String, default: '' })
  city: string;

  @Prop({ type: String, default: '' })
  zipCode: string;
}

@Schema({ _id: false })
export class EmergencyContact {
  @Prop({ type: String, default: '' })
  name: string;

  @Prop({ type: String, default: '' })
  phone: string;
}

@Schema({ _id: false })
export class DrivingLicenseInfo {
  @Prop({ type: String, required: true, uppercase: true, trim: true })
  licenseNumber: string;

  @Prop({ type: String, default: 'Class A (Commercial)' })
  licenseClass: string;

  @Prop({ type: String, required: true })
  expiryDate: string;

  @Prop({ type: String, default: null })
  licenseCopyUrl: string;
}

@Schema({ _id: false })
export class VehicleConfiguration {
  @Prop({ type: String, default: 'None (Unassigned)' })
  vehicleAssignment: string;

  @Prop({ type: String, default: 'Available' })
  defaultAvailability: string;

  @Prop({ type: String, default: 'Normal' })
  dispatchPriority: string;

  @Prop({ type: [String], default: [] })
  restrictions: string[];

  @Prop({ type: String, default: null })
  insuranceProofUrl: string;
}

@Schema({ _id: false })
export class WorkingSchedule {
  @Prop({ type: String, default: '08:00 - 18:00' })
  monHours: string;

  @Prop({ type: String, default: '08:00 - 18:00' })
  tueHours: string;

  @Prop({ type: String, default: '08:00 - 18:00' })
  wedHours: string;

  @Prop({ type: String, default: '08:00 - 18:00' })
  thuHours: string;

  @Prop({ type: String, default: '08:00 - 18:00' })
  friHours: string;

  @Prop({ type: String, default: '08:00 - 18:00' })
  satHours: string;

  @Prop({ type: String, default: '08:00 - 18:00' })
  sunHours: string;
}

@Schema({ _id: false })
export class PayoutInfo {
  @Prop({ type: String, default: '' })
  bankName: string;

  @Prop({ type: String, default: '' })
  accountNumber: string;

  @Prop({ type: String, default: '' })
  routingCode: string; // IFSC / Routing code
}

@Schema({ timestamps: true, collection: 'drivers' })
export class Driver {
  @Prop({ type: String, required: true, trim: true })
  firstName: string;

  @Prop({ type: String, required: true, trim: true })
  lastName: string;

  @Prop({ type: String, trim: true })
  fullName: string;

  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ type: String, required: true, unique: true, trim: true, index: true })
  phoneNumber: string;

  @Prop({ type: String, default: null })
  avatar?: string;

  // Address & Emergency Contacts
  @Prop({ type: DriverAddress, default: () => ({}) })
  address: DriverAddress;

  @Prop({ type: EmergencyContact, default: () => ({}) })
  emergencyContact: EmergencyContact;

  // Driving License
  @Prop({ type: DrivingLicenseInfo, required: true })
  license: DrivingLicenseInfo;

  // Vehicle Configuration
  @Prop({ type: VehicleConfiguration, default: () => ({}) })
  vehicleConfig: VehicleConfiguration;

  // Working Schedule
  @Prop({ type: WorkingSchedule, default: () => ({}) })
  workingSchedule: WorkingSchedule;

  // Payout Information
  @Prop({ type: PayoutInfo, default: () => ({}) })
  payout: PayoutInfo;

  // Hierarchy Affiliation
  @Prop({ type: String, required: true, index: true })
  companyId: string;

  @Prop({ type: String, default: null, index: true })
  driverManagerId?: string;

  @Prop({ type: String, default: null })
  createdBy?: string;

  // Authentication & Security
  @Prop({ type: String, default: null })
  password?: string;

  @Prop({ type: String, default: UserRole.DRIVER })
  role: string;

  @Prop({
    type: String,
    enum: [
      DriverStatus.ACTIVE,
      DriverStatus.INACTIVE,
      DriverStatus.ON_RIDE,
      DriverStatus.OFF_DUTY,
      DriverStatus.ON_CALL,
      'Active',
      'Inactive',
      'active',
      'inactive',
    ],
    default: DriverStatus.ACTIVE,
    index: true,
  })
  status: string;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Boolean, default: true })
  isVerified: boolean;

  @Prop({ type: String, default: null })
  otp?: string;

  @Prop({ type: Date, default: null })
  otpExpireAt?: Date;

  @Prop({ type: Boolean, default: false })
  isPasswordReset: boolean;
}

export const DriverSchema = SchemaFactory.createForClass(Driver);

DriverSchema.pre('save', async function () {
  if (this.firstName || this.lastName) {
    this.fullName = `${this.firstName || ''} ${this.lastName || ''}`.trim();
  }
  if (this.status) {
    const s = String(this.status).toUpperCase();
    if (s === 'ACTIVE') this.status = DriverStatus.ACTIVE;
    else if (s === 'INACTIVE') this.status = DriverStatus.INACTIVE;
  }
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

DriverSchema.index({ fullName: 'text', email: 'text', phoneNumber: 'text' });
DriverSchema.index({ companyId: 1, status: 1 });
DriverSchema.index({ companyId: 1, driverManagerId: 1 });
