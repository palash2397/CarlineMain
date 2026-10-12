import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

import { RatingFor } from 'src/common/enums/driver/rating-enum';

export type RatingDocument = HydratedDocument<Rating>;

@Schema({
  timestamps: true,
})
export class Rating {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    required: true,
    index: true,
  })
  ride: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  givenBy: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: true,
    index: true,
  })
  givenTo: mongoose.Types.ObjectId;

  @Prop({
    enum: RatingFor,
    default: RatingFor.DRIVER,
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
RatingSchema.index({
  givenTo: 1,
  ratingFor: 1,
});
