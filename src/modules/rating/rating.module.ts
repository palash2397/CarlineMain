import { Module } from '@nestjs/common';
import { RatingService } from './rating.service';
import { RatingController } from './rating.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Rating, RatingSchema } from './schema/rating.schema';
import { User, UserSchema } from '../user/schema/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rating.name, schema: RatingSchema },
      { name: User.name, schema: UserSchema },
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
