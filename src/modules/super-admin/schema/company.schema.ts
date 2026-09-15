import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserRole } from 'src/common/enums/user/role.enum';
import { CompanyStatus } from 'src/common/enums/companies/status-enum';

export type CompanyDocument = Company & Document;

@Schema({ _id: false })
export class AddressInfo {
  @Prop({ type: String, default: '' })
  streetAddress: string;

  @Prop({ type: String, required: true })
  city: string;

  @Prop({ type: String, required: true })
  state: string;

  @Prop({ type: String, default: '' })
  zipCode: string;

  @Prop({ type: String, default: 'India' })
  country: string;

  @Prop({ type: String, default: 'UTC' })
  timezone: string;
}

@Schema({ _id: false })
export class PrimaryContactInfo {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, required: true, trim: true })
  phone: string;
}

@Schema({ _id: false })
export class BillingInfo {
  @Prop({ type: String, default: '' })
  contactName: string;

  @Prop({ type: String, default: '' })
  email: string;

  @Prop({ type: String, default: '' })
  phone: string;

  @Prop({ type: String, default: '' })
  address: string;
}

@Schema({ _id: false })
export class BrandingInfo {
  @Prop({ type: String, default: '' })
  logo: string;

  @Prop({ type: String, default: '#E05326' })
  brandColor: string;

  @Prop({ type: String, default: '' })
  displayNameOverride: string;
}

@Schema({ _id: false })
export class CompanyDocumentItem {
  @Prop({ type: String, default: 'Business License' })
  documentType: string;

  @Prop({ type: String, default: '' })
  documentName: string;

  @Prop({ type: String, default: '' })
  documentUrl: string;

  @Prop({ type: String, default: '' })
  issueDate: string;

  @Prop({ type: String, default: '' })
  expiryDate: string;

  @Prop({
    type: String,
    enum: CompanyStatus,
    default: CompanyStatus.APPROVED,
  })
  status: string;
}

@Schema({ timestamps: true })
export class Company {
  @Prop({ type: String, unique: true, index: true })
  companyId: string; // e.g. CMP-001, CMP-002

  @Prop({ type: String, required: true, trim: true })
  legalName: string;

  @Prop({ type: String, required: true, trim: true })
  displayName: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  })
  companyCode: string; // e.g. ABCTX

  @Prop({ type: String, default: '' })
  registrationNumber: string;

  @Prop({
    type: String,
    enum: ['Active', 'Suspended', 'Inactive'],
    default: 'Active',
  })
  status: string;

  @Prop({ type: AddressInfo, required: true })
  address: AddressInfo;

  @Prop({ type: PrimaryContactInfo, required: true })
  primaryContact: PrimaryContactInfo;

  @Prop({ type: BillingInfo, default: () => ({}) })
  billing: BillingInfo;

  @Prop({ type: BrandingInfo, default: () => ({}) })
  branding: BrandingInfo;

  @Prop({ type: [CompanyDocumentItem], default: [] })
  documents: CompanyDocumentItem[];

  @Prop({ type: String, default: null })
  adminUserId: string; // Link to User ID of the primary admin

  @Prop({ type: String, default: null })
  password?: string;

  @Prop({ type: String, default: UserRole.COMPANY_ADMIN })
  role: string;

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

  @Prop({ type: String, default: 'SUPERADMIN' })
  createdBy: string;
}

export const CompanySchema = SchemaFactory.createForClass(Company);

CompanySchema.pre('save', async function () {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

CompanySchema.index({
  legalName: 'text',
  displayName: 'text',
  companyCode: 'text',
});
CompanySchema.index({ 'primaryContact.email': 1 });
CompanySchema.index({ 'primaryContact.phone': 1 });
CompanySchema.index({ 'address.city': 1 });
CompanySchema.index({ status: 1 });
CompanySchema.index({ createdAt: -1 });
