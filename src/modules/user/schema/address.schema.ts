import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

import { AddressType } from 'src/common/enums/user/address.enum';

export type AddressDocument = HydratedDocument<Address>;

// A place the passenger saved from the Saved Places screen. `user` is stored as
// a string, the same way `ride.user` and `ride.driver` are stored.
@Schema({ timestamps: true })
export class Address {
  @Prop({
    type: String,
    required: true,
    index: true,
  })
  user: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 60,
  })
  label: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 300,
  })
  address: string;

  @Prop({
    type: String,
    enum: AddressType,
    default: AddressType.OTHER,
  })
  type: AddressType;

  // Filled when the app picked the place from the map, so Book Ride to Here can
  // send the same pickup coordinates to POST /ride/book.
  @Prop({
    type: Number,
    default: null,
  })
  latitude?: number | null;

  @Prop({
    type: Number,
    default: null,
  })
  longitude?: number | null;
}

export const AddressSchema = SchemaFactory.createForClass(Address);
