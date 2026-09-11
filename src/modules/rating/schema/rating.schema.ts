import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

import { User } from 'src/modules/user/schema/user.schema';
import { RatingFor } from 'src/common/enums/driver/rating-enum';

export type RatingDocument = HydratedDocument<Rating>;

@Schema({
  timestamps: true,
})
export class Rating {
  // @Prop({
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: Ride.name,
  //   required: true,
  // })
  // ride: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  givenBy: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  givenTo: mongoose.Types.ObjectId;

  @Prop({
    enum: RatingFor,
    required: true,
  })
  ratingFor: RatingFor;

  @Prop({
    required: true,
    min: 1,
    max: 5,
  })
  rating: number;

  @Prop({
    default: '',
    trim: true,
  })
  review: string;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);
RatingSchema.index(
  {
    ride: 1,
    givenBy: 1,
  },
  {
    unique: true,
  },
);
