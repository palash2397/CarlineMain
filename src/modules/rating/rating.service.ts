import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Rating, RatingDocument } from './schema/rating.schema';
import { User, UserDocument } from '../user/schema/user.schema';
import { Driver, DriverDocument } from '../driver/schema/driver.schema';
import { Ride, RideDocument } from '../ride/schema/ride.schema';
import { RideStatus } from 'src/common/enums/ride/ride-status.enum';

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

    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,

    @InjectModel(Ride.name)
    private readonly rideModel: Model<RideDocument>,
  ) {}

  // ==========================================================
  // Point 15: Customer rating (Passenger rates Driver)
  // ==========================================================
  async createRating(userId: string, dto: CreateRatingDto) {
    try {
      if (!Types.ObjectId.isValid(dto.rideId)) {
        return new ApiResponse(400, {}, Msg.RIDE_NOT_FOUND);
      }

      const ride = await this.rideModel.findById(dto.rideId);
      if (!ride) {
        return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
      }

      // Must be the passenger of the ride
      if (String(ride.user) !== String(userId)) {
        return new ApiResponse(
          403,
          {},
          'You are not authorized to rate this ride',
        );
      }

      // Ride must be completed
      if (ride.status !== RideStatus.RIDE_COMPLETED) {
        return new ApiResponse(
          400,
          {},
          'Ride must be completed before rating the driver',
        );
      }

      // Driver must be present on ride
      if (!ride.driver) {
        return new ApiResponse(400, {}, 'No driver assigned to this ride');
      }

      const driverId = String(ride.driver);

      // Check if already rated
      const existing = await this.ratingModel.findOne({
        ride: new Types.ObjectId(dto.rideId),
        givenBy: new Types.ObjectId(userId),
      });

      if (existing) {
        return new ApiResponse(400, {}, Msg.RATING_ALREADY_SUBMITTED);
      }

      // Create rating record
      const ratingDoc = await this.ratingModel.create({
        ride: new Types.ObjectId(dto.rideId),
        givenBy: new Types.ObjectId(userId),
        givenTo: new Types.ObjectId(driverId),
        ratingFor: RatingFor.DRIVER,
        rating: dto.rating,
        review: dto.review || '',
      });

      // Recalculate average rating of the driver
      const stats = await this.ratingModel.aggregate([
        {
          $match: {
            givenTo: new Types.ObjectId(driverId),
            ratingFor: RatingFor.DRIVER,
          },
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating' },
            totalRatings: { $sum: 1 },
          },
        },
      ]);

      const avgRating =
        stats.length > 0 ? Number(stats[0].avgRating.toFixed(1)) : dto.rating;

      await this.driverModel.findByIdAndUpdate(driverId, {
        rating: avgRating,
      });

      // Log into ride timeline if available
      if (Array.isArray(ride.timeline)) {
        ride.timeline.push({
          event: 'RATING_SUBMITTED',
          title: 'Driver Rated',
          description: `Passenger rated the driver ${dto.rating} star(s)`,
          timestamp: new Date(),
          actor: String(userId),
        });
        await ride.save();
      }

      return new ApiResponse(201, ratingDoc, Msg.RATING_SUBMITTED);
    } catch (error) {
      console.error('Error while submitting rating:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Get rating submitted for a specific ride
  // ==========================================================
  async getRideRating(rideId: string) {
    try {
      if (!Types.ObjectId.isValid(rideId)) {
        return new ApiResponse(400, {}, Msg.RIDE_NOT_FOUND);
      }

      const rating = await this.ratingModel
        .findOne({ ride: new Types.ObjectId(rideId) })
        .populate('givenBy', 'fullName name email avatar')
        .populate(
          'givenTo',
          'fullName phoneNumber avatar rating vehicleRegistrationNumber',
        )
        .lean();

      if (!rating) {
        return new ApiResponse(404, {}, Msg.RATING_NOT_FOUND);
      }

      return new ApiResponse(200, rating, Msg.RATING_FETCHED);
    } catch (error) {
      console.error('Error while fetching ride rating:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Get all reviews and ratings for a driver
  // ==========================================================
  async getDriverReviews(driverId: string, page = 1, limit = 10) {
    try {
      if (!Types.ObjectId.isValid(driverId)) {
        return new ApiResponse(400, {}, Msg.DRIVER_NOT_FOUND);
      }

      const skip = (Math.max(1, page) - 1) * Math.max(1, limit);

      const [reviews, totalCount, stats] = await Promise.all([
        this.ratingModel
          .find({
            givenTo: new Types.ObjectId(driverId),
            ratingFor: RatingFor.DRIVER,
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('givenBy', 'fullName name avatar')
          .lean(),
        this.ratingModel.countDocuments({
          givenTo: new Types.ObjectId(driverId),
          ratingFor: RatingFor.DRIVER,
        }),
        this.ratingModel.aggregate([
          {
            $match: {
              givenTo: new Types.ObjectId(driverId),
              ratingFor: RatingFor.DRIVER,
            },
          },
          {
            $group: {
              _id: null,
              avgRating: { $avg: '$rating' },
              total: { $sum: 1 },
              fiveStar: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
              fourStar: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
              threeStar: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
              twoStar: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
              oneStar: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
            },
          },
        ]),
      ]);

      const summary = stats[0] || {
        avgRating: 5.0,
        total: 0,
        fiveStar: 0,
        fourStar: 0,
        threeStar: 0,
        twoStar: 0,
        oneStar: 0,
      };

      return new ApiResponse(
        200,
        {
          driverId,
          averageRating: Number(summary.avgRating ? summary.avgRating.toFixed(1) : 5.0),
          totalRatings: summary.total || totalCount,
          breakdown: {
            fiveStar: summary.fiveStar || 0,
            fourStar: summary.fourStar || 0,
            threeStar: summary.threeStar || 0,
            twoStar: summary.twoStar || 0,
            oneStar: summary.oneStar || 0,
          },
          pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit) || 1,
          },
          reviews,
        },
        Msg.REVIEWS_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching driver reviews:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Get ratings submitted by current logged in user
  // ==========================================================
  async myReviews(userId: string, page = 1, limit = 10) {
    try {
      const skip = (Math.max(1, page) - 1) * Math.max(1, limit);

      const [reviews, totalCount] = await Promise.all([
        this.ratingModel
          .find({ givenBy: new Types.ObjectId(userId) })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate(
            'givenTo',
            'fullName phoneNumber avatar rating vehicleRegistrationNumber',
          )
          .populate('ride', 'pickup dropoff scheduledAt completedAt totalFare')
          .lean(),
        this.ratingModel.countDocuments({
          givenBy: new Types.ObjectId(userId),
        }),
      ]);

      return new ApiResponse(
        200,
        {
          pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit) || 1,
          },
          reviews,
        },
        Msg.REVIEWS_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching my reviews:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }
}
