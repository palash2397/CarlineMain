import { Module } from '@nestjs/common';
import { RatingService } from './rating.service';
import { RatingController } from './rating.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Rating, RatingSchema } from './schema/rating.schema';
import { User, UserSchema } from '../user/schema/user.schema';
import { Driver, DriverSchema } from '../driver/schema/driver.schema';
import { Ride, RideSchema } from '../ride/schema/ride.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rating.name, schema: RatingSchema },
      { name: User.name, schema: UserSchema },
      { name: Driver.name, schema: DriverSchema },
      { name: Ride.name, schema: RideSchema },
    ]),
  ],
  controllers: [RatingController],
  providers: [RatingService],

  exports: [
    RatingService,
    MongooseModule.forFeature([{ name: Rating.name, schema: RatingSchema }]),
  ],
})
export class RatingModule {}
