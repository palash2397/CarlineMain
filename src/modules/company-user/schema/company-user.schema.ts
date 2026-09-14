import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserRole } from 'src/common/enums/user/role.enum';
import * as bcrypt from 'bcrypt';

import { StatusEnum } from 'src/common/enums/general/status-enum';

export type CompanyUserDocument = HydratedDocument<CompanyUser>;

@Schema({
  timestamps: true,
  collection: 'company_users',
})
export class CompanyUser {
  @Prop({
    type: String,
    trim: true,
    required: true,
  })
  fullName: string;

  @Prop({
    type: String,
    trim: true,
    default: '',
  })
  firstName: string;

  @Prop({
    type: String,
    trim: true,
    default: '',
  })
  lastName: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true,
  })
  email: string;

  @Prop({
    type: String,
    required: false,
    trim: true,
    default: null,
  })
  phoneNumber?: string;

  @Prop({
    type: String,
    required: true,
  })
  password: string;

  @Prop({
    type: String,
    enum: UserRole,
    required: true,
  })
  role: UserRole;

  @Prop({
    type: String,
    required: true,
    index: true,
  })
  companyId: string;

  @Prop({
    type: String,
    enum: [
      StatusEnum.ACTIVE,
      StatusEnum.INACTIVE,
      'Active',
      'Inactive',
      'active',
      'inactive',
    ],
    default: StatusEnum.ACTIVE,
  })
  status: StatusEnum;

  @Prop({
    type: Boolean,
    default: true,
  })
  isActive: boolean;

  @Prop({
    type: String,
    default: null,
  })
  avatar?: string;

  @Prop({
    type: String,
    default: null,
  })
  otp?: string;

  @Prop({
    type: Date,
    default: null,
  })
  otpExpireAt?: Date;

  @Prop({
    type: Boolean,
    default: false,
  })
  isPasswordReset: boolean;

  @Prop({
    type: Boolean,
    default: true,
  })
  isVerified: boolean;
}

export const CompanyUserSchema = SchemaFactory.createForClass(CompanyUser);

CompanyUserSchema.pre('save', async function (next) {
  if (this.status) {
    const s = String(this.status).toUpperCase();
    if (s === 'ACTIVE') this.status = StatusEnum.ACTIVE;
    else if (s === 'INACTIVE') this.status = StatusEnum.INACTIVE;
  }
  if (!this.isModified('password') || !this.password) {
    return;
  }
  this.password = await bcrypt.hash(this.password, 10);
});
