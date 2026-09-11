import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Rating, RatingDocument } from './schema/rating.schema';
import { User, UserDocument } from '../user/schema/user.schema';

// import { UserRole } from 'src/common/enums/user/role.enum';
import { RideStatus } from 'src/common/enums/ride/ride-enum';

import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';

import { CreateRatingDto } from './dto/create-rating.dto';
import { RatingFor } from 'src/common/enums/driver/rating-enum';

@Injectable()
export class RatingService {
  constructor(
    @InjectModel(Rating.name)
    private readonly ratingModel: Model<RatingDocument>,

    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}
}
