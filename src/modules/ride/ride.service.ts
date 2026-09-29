import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import { Model, Types } from 'mongoose';

import { ApiResponse } from 'src/helpers/ApiResponse';
import { generateOtp } from 'src/helpers/index';
import { Msg } from 'src/helpers/responseMsg';

import { DriverStatus } from 'src/common/enums/driver/status-enum';
import { CancelledBy } from 'src/common/enums/ride/cancelled-by.enum';
import { PaymentMethod } from 'src/common/enums/ride/payment-method.enum';
import { PaymentStatus } from 'src/common/enums/ride/payment-status.enum';
import { PromoType } from 'src/common/enums/ride/promo-type.enum';
import { RecurringStatus } from 'src/common/enums/ride/recurring-status.enum';
import {
  ACTIVE_RIDE_STATUSES,
  RideStatus,
} from 'src/common/enums/ride/ride-status.enum';
import { RideType } from 'src/common/enums/ride/ride-type.enum';

import { Driver, DriverDocument } from '../driver/schema/driver.schema';
import { Pricing, PricingDocument } from '../pricing/schema/pricing.schema';
import { SocketService } from '../socket/socket.service';
import { User, UserDocument } from '../user/schema/user.schema';
import {
  VehicleType,
  VehicleTypeDocument,
} from '../vehicle-type/schema/vehicle-type.schema';

import { Promo, PromoDocument } from './schema/promo.schema';
import {
  RecurringBooking,
  RecurringBookingDocument,
} from './schema/recurring-booking.schema';
import {
  Ride,
  RideDocument,
  RideFareBreakdown,
  RideLocation,
} from './schema/ride.schema';

import {
  AVERAGE_SPEED_KMH,
  DEFAULT_CURRENCY,
  DRIVER_REQUEST_LIMIT,
  DRIVER_RUNNING_STATUSES,
  DRIVER_SEARCH_RADIUS_KM,
  KM_PER_MILE,
  RECURRING_DISPATCH_BATCH_SIZE,
  RECURRING_LOOKAHEAD_DAYS,
  RECURRING_MATERIALIZE_LEAD_MINUTES,
  RIDE_EVENTS,
  SCHEDULED_DISPATCH_BATCH_SIZE,
  SCHEDULED_DISPATCH_LEAD_MINUTES,
} from 'src/constants';

import { BookRideDto } from './dto/book-ride.dto';
import { CancelRideDto } from './dto/cancel-ride.dto';
import { CreateRecurringRideDto } from './dto/create-recurring-ride.dto';
import { DriverCancelRideDto } from './dto/driver-cancel-ride.dto';
import { DriverCollectPaymentDto } from './dto/driver-collect-payment.dto';
import { DriverDutyDto } from './dto/driver-duty.dto';
import {
  DriverEarningsQueryDto,
  EarningsRange,
} from './dto/driver-earnings-query.dto';
import { DriverLocationDto } from './dto/driver-location.dto';
import { DriverRideHistoryQueryDto } from './dto/driver-ride-history-query.dto';
import { DriverRideIdDto } from './dto/driver-ride-id.dto';
import { DriverStartRideDto } from './dto/driver-start-ride.dto';
import { EstimateFareDto } from './dto/estimate-fare.dto';
import { MyRecurringRidesQueryDto } from './dto/my-recurring-rides-query.dto';
import { MyRidesQueryDto } from './dto/my-rides-query.dto';
import { NearbyCabsDto } from './dto/nearby-cabs.dto';
import { UpdateRecurringRideStatusDto } from './dto/update-recurring-ride-status.dto';
import { UpdateRecurringRideDto } from './dto/update-recurring-ride.dto';

const CANCELLABLE_STATUSES = [
  RideStatus.SCHEDULED,
  RideStatus.SEARCHING_DRIVER,
  RideStatus.DRIVER_ASSIGNED,
  RideStatus.DRIVER_ARRIVED,
];

// A driver can only cancel before the trip is started.
const DRIVER_CANCELLABLE_STATUSES = [
  RideStatus.DRIVER_ASSIGNED,
  RideStatus.DRIVER_ARRIVED,
];

// Approval statuses that cannot go online at all.
const DRIVER_BLOCKED_STATUSES = [
  DriverStatus.PENDING_APPROVAL,
  DriverStatus.REJECTED,
  DriverStatus.INACTIVE,
];

const EARNINGS_WINDOW_DAYS: Record<EarningsRange, number | null> = {
  TODAY: 1,
  WEEK: 7,
  MONTH: 30,
  ALL: null,
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Ride booking in one place: passenger side (/ride/*) + driver side
// (/driver-ride/*, role DRIVER).
@Injectable()
export class RideService {
  constructor(
    @InjectModel(Ride.name)
    private readonly rideModel: Model<RideDocument>,
    @InjectModel(Promo.name)
    private readonly promoModel: Model<PromoDocument>,
    @InjectModel(RecurringBooking.name)
    private readonly recurringModel: Model<RecurringBookingDocument>,
    @InjectModel(VehicleType.name)
    private readonly vehicleTypeModel: Model<VehicleTypeDocument>,
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
    @InjectModel(Pricing.name)
    private readonly pricingModel: Model<PricingDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly socketService: SocketService,
  ) {}

  // ==========================================================
  // Vehicle types (booking screen vehicle list)
  // ==========================================================
  async listVehicleTypes() {
    try {
      const types = await this.vehicleTypeModel
        .find({ status: 'Active' })
        .sort({ sortOrder: 1, createdAt: 1 })
        .select('-__v');

      return new ApiResponse(200, types, Msg.VEHICLE_TYPES_FETCHED);
    } catch (error) {
      console.error('Error while fetching vehicle types for booking:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Promo codes
  // ==========================================================
  async promoCodes() {
    try {
      const promos = await this.promoModel
        .find({
          isActive: true,
          $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
        })
        .sort({ createdAt: -1 });

      return new ApiResponse(
        200,
        promos.map((promo) => this.promoPayload(promo)),
        Msg.PROMO_CODES_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching promo codes:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Fare estimate for every vehicle type (upfront fare card)
  // ==========================================================
  async estimateFare(_user: any, dto: EstimateFareDto) {
    try {
      const types = await this.activeVehicleTypes();

      if (!types.length) {
        return new ApiResponse(404, {}, Msg.VEHICLE_TYPE_NOT_FOUND);
      }

      const route = await this.resolveDistance(dto.pickup, dto.dropoff);

      if (route.distanceKm === null) {
        return new ApiResponse(
          400,
          {},
          route.routeError || Msg.ROUTE_NOT_FOUND,
        );
      }

      const pricing = await this.pricingModel.findOne({}).lean();
      const distanceKm = route.distanceKm;
      const durationMinutes = route.durationMinutes || 0;

      const options = types.map((type) => {
        const fare = this.calculateFare(type, pricing, {
          distanceKm,
          durationMinutes,
          promo: null,
        });

        return {
          vehicleTypeId: String((type as any)._id),
          name: type.name,
          seats: type.seats,
          badge: type.badge || null,
          etaText: type.etaText || null,
          image: type.image || null,
          description: type.description || null,
          sortOrder: type.sortOrder,
          distanceKm: Number(distanceKm.toFixed(2)),
          distanceMiles: this.toMiles(distanceKm),
          durationMinutes: Math.round(durationMinutes),
          etaMinutes: Math.round(durationMinutes),
          fare,
          totalFare: fare.totalFare,
          payableFare: fare.payableFare,
        };
      });

      return new ApiResponse(
        200,
        {
          pickup: dto.pickup,
          dropoff: dto.dropoff,
          distanceKm: Number(distanceKm.toFixed(2)),
          distanceMiles: this.toMiles(distanceKm),
          durationMinutes: Math.round(durationMinutes),
          etaMinutes: Math.round(durationMinutes),
          routeSource: route.routeSource,
          currency: DEFAULT_CURRENCY,
          options,
        },
        Msg.FARE_ESTIMATED,
      );
    } catch (error) {
      console.error('Error while estimating fare:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Book a ride (Confirm and Book button)
  // ==========================================================
  async bookRide(user: any, dto: BookRideDto) {
    try {
      // A passenger can only have one live ride at a time. Without this guard
      // the same user gets joined to two ride rooms, so both rides keep
      // pushing driver, status and location events into the same app.
      const activeRide = await this.findActiveRide(user.id);

      if (activeRide) {
        return new ApiResponse(
          400,
          {
            rideId: String(activeRide._id),
            status: activeRide.status,
          },
          Msg.RIDE_ALREADY_ACTIVE,
        );
      }

      if (!Types.ObjectId.isValid(dto.vehicleTypeId)) {
        return new ApiResponse(404, {}, Msg.VEHICLE_TYPE_NOT_FOUND);
      }

      const vehicleType = await this.vehicleTypeModel.findById(dto.vehicleTypeId);

      if (!vehicleType || vehicleType.status !== 'Active') {
        return new ApiResponse(404, {}, Msg.VEHICLE_TYPE_NOT_FOUND);
      }

      const rideType = dto.rideType || RideType.INSTANT;
      let scheduledAt: Date | null = null;

      // A repeating ride is created from the recurring booking API, not here.
      if (rideType === RideType.RECURRING) {
        return new ApiResponse(400, {}, Msg.RECURRING_USE_SERIES);
      }

      if (rideType === RideType.SCHEDULED) {
        if (!dto.scheduledAt) {
          return new ApiResponse(400, {}, Msg.SCHEDULE_TIME_REQUIRED);
        }

        scheduledAt = new Date(dto.scheduledAt);

        if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
          return new ApiResponse(400, {}, Msg.SCHEDULE_TIME_INVALID);
        }
      }

      const route = await this.resolveDistance(dto.pickup, dto.dropoff);

      if (route.distanceKm === null) {
        return new ApiResponse(
          400,
          {},
          route.routeError || Msg.ROUTE_NOT_FOUND,
        );
      }

      const promoCheck = await this.resolvePromo(dto.promoCode);

      if (dto.promoCode && !promoCheck.promo) {
        return new ApiResponse(400, {}, promoCheck.error || Msg.PROMO_INVALID);
      }

      const pricing = await this.pricingModel.findOne({}).lean();
      const distanceKm = route.distanceKm;
      const durationMinutes = route.durationMinutes || 0;

      const fare = this.calculateFare(vehicleType, pricing, {
        distanceKm,
        durationMinutes,
        promo: promoCheck.promo,
      });

      const ride = await this.rideModel.create({
        user: user.id,
        companyId: user.companyId || null,
        vehicleTypeId: String((vehicleType as any)._id),
        vehicleTypeName: vehicleType.name,
        // A scheduled ride waits for its pickup time, so the drivers are only
        // notified by the scheduler and not at booking time.
        status:
          rideType === RideType.SCHEDULED
            ? RideStatus.SCHEDULED
            : RideStatus.SEARCHING_DRIVER,
        pickup: this.locationPayload(dto.pickup),
        dropoff: this.locationPayload(dto.dropoff),
        distanceKm: Number(distanceKm.toFixed(2)),
        durationMinutes: Math.round(durationMinutes),
        etaMinutes: Math.round(durationMinutes),
        routeSource: route.routeSource,
        fare,
        totalFare: fare.totalFare,
        payableFare: fare.payableFare,
        promoCode: promoCheck.promo ? promoCheck.promo.code : null,
        discount: fare.discount,
        rideType,
        scheduledAt,
        passengerCount: dto.passengerCount || 1,
        paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
        paymentStatus: PaymentStatus.PENDING,
        notes: dto.notes || null,
        otp: generateOtp(),
      });

      if (promoCheck.promo) {
        await this.promoModel.updateOne(
          { _id: (promoCheck.promo as any)._id },
          { $inc: { usedCount: 1 } },
        );
      }

      const summary = this.rideSummary(ride, vehicleType);
      const rideId = String(ride._id);

      // The passenger could be connected before the ride existed, so the app is
      // put inside the ride room right here.
      this.socketService.joinActorToRide(user.id, rideId);
      this.socketService.emitToRideAndActor(
        user.id,
        rideId,
        RIDE_EVENTS.CREATED,
        summary,
      );
      if (rideType !== RideType.SCHEDULED) {
        this.notifyDrivers(summary);
      }

      return new ApiResponse(200, summary, Msg.RIDE_BOOKED);
    } catch (error) {
      console.error('Error while booking ride:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Ride activity of the logged in passenger
  // ==========================================================
  async myRides(user: any, query: MyRidesQueryDto) {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;

      const filter: any = { user: user.id };

      if (query.status) {
        filter.status = query.status;
      }

      const [items, total] = await Promise.all([
        this.rideModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        this.rideModel.countDocuments(filter),
      ]);

      return new ApiResponse(
        200,
        {
          items: items.map((ride) => this.rideSummary(ride)),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
        Msg.RIDES_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching rides:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async activeRide(user: any) {
    try {
      const ride = await this.findActiveRide(user.id);

      if (!ride) {
        return new ApiResponse(200, null, Msg.NO_ACTIVE_TRIP);
      }

      return new ApiResponse(
        200,
        await this.rideDetailsPayload(ride),
        Msg.RIDE_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching active ride:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // Used by the socket gateway so a reconnecting passenger lands directly into
  // the room of the ride that is running right now.
  async activeRideIdForUser(userId: string) {
    try {
      const ride = await this.findActiveRide(userId).select('_id');

      return ride ? String(ride._id) : null;
    } catch (error) {
      console.error('Error while looking up the active ride:', error);
      return null;
    }
  }

  async rideDetails(user: any, rideId: string) {
    try {
      if (!Types.ObjectId.isValid(rideId)) {
        return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
      }

      const ride = await this.rideModel.findOne({ _id: rideId, user: user.id });

      if (!ride) {
        return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
      }

      return new ApiResponse(
        200,
        await this.rideDetailsPayload(ride),
        Msg.RIDE_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching ride details:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Cancel ride
  // ==========================================================
  async cancelRide(user: any, dto: CancelRideDto) {
    try {
      if (!Types.ObjectId.isValid(dto.rideId)) {
        return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
      }

      const ride = await this.rideModel.findOne({
        _id: dto.rideId,
        user: user.id,
      });

      if (!ride) {
        return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
      }

      if (!CANCELLABLE_STATUSES.includes(ride.status)) {
        return new ApiResponse(400, {}, Msg.RIDE_CANNOT_CANCEL);
      }

      ride.status = RideStatus.RIDE_CANCELLED;
      ride.cancelReason = dto.reason || null;
      ride.cancelledBy = CancelledBy.USER;
      ride.cancelledAt = new Date();
      await ride.save();

      if (ride.driver) {
        await this.driverModel.updateOne(
          { _id: ride.driver },
          { $set: { status: DriverStatus.ACTIVE } },
        );
      }

      const payload = {
        rideId: String(ride._id),
        status: ride.status,
        reason: ride.cancelReason,
        cancelledBy: ride.cancelledBy,
        cancelledAt: ride.cancelledAt,
      };

      this.socketService.emitToRide(
        String(ride._id),
        RIDE_EVENTS.CANCELLED,
        payload,
      );

      return new ApiResponse(200, payload, Msg.RIDE_CANCELLED);
    } catch (error) {
      console.error('Error while cancelling ride:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Scheduled rides that are due move to the driver search
  // ==========================================================
  // The passenger app cannot be trusted to wake up at the pickup time, so the
  // due rides are read from the database on every scheduler run. A pm2 reload
  // therefore never drops a scheduled ride.
  async promoteDueScheduledRides() {
    const dueBefore = new Date(
      Date.now() + SCHEDULED_DISPATCH_LEAD_MINUTES * 60 * 1000,
    );

    const due = await this.rideModel
      .find({
        // A recurring pickup is created as a scheduled ride, so both are handed
        // to the drivers from here.
        rideType: { $in: [RideType.SCHEDULED, RideType.RECURRING] },
        status: RideStatus.SCHEDULED,
        scheduledAt: { $ne: null, $lte: dueBefore },
      })
      .sort({ scheduledAt: 1 })
      .limit(SCHEDULED_DISPATCH_BATCH_SIZE);

    let promoted = 0;

    for (const ride of due) {
      // The passenger is already inside a live ride, so this scheduled ride
      // waits for the next run instead of pushing the app into two rides.
      if (await this.findActiveRide(ride.user)) {
        continue;
      }

      const claimed = await this.rideModel.findOneAndUpdate(
        { _id: ride._id, status: RideStatus.SCHEDULED },
        { $set: { status: RideStatus.SEARCHING_DRIVER } },
        { new: true },
      );

      if (!claimed) {
        continue;
      }

      const vehicleType = await this.vehicleTypeModel.findById(
        claimed.vehicleTypeId,
      );

      this.notifyDrivers(this.rideSummary(claimed, vehicleType));
      this.emitRideEvent(
        claimed,
        RIDE_EVENTS.STATUS,
        this.statusPayload(claimed),
      );

      promoted += 1;
    }

    return promoted;
  }

  // ==========================================================
  // Recurring bookings (a ride that repeats on fixed days)
  // ==========================================================
  // A series is only a template. Every pickup gets its own ride, created by the
  // scheduler, so tracking, driver assignment, cancel and history stay the same
  // as a one time ride.
  async createRecurringRide(user: any, dto: CreateRecurringRideDto) {
    try {
      const daysOfWeek = this.cleanDaysOfWeek(dto.daysOfWeek);

      if (!daysOfWeek.length) {
        return new ApiResponse(400, {}, Msg.RECURRING_DAYS_REQUIRED);
      }

      if (!this.parsePickupTime(dto.pickupTime)) {
        return new ApiResponse(400, {}, Msg.RECURRING_TIME_INVALID);
      }

      const startDate = new Date(dto.startDate);

      if (Number.isNaN(startDate.getTime())) {
        return new ApiResponse(400, {}, Msg.RECURRING_DATE_INVALID);
      }

      let endDate: Date | null = null;

      if (dto.endDate) {
        endDate = new Date(dto.endDate);

        if (Number.isNaN(endDate.getTime())) {
          return new ApiResponse(400, {}, Msg.RECURRING_DATE_INVALID);
        }

        if (
          this.endOfDay(endDate).getTime() <
          this.startOfDay(startDate).getTime()
        ) {
          return new ApiResponse(400, {}, Msg.RECURRING_DATE_RANGE_INVALID);
        }
      }

      if (!Types.ObjectId.isValid(dto.vehicleTypeId)) {
        return new ApiResponse(404, {}, Msg.VEHICLE_TYPE_NOT_FOUND);
      }

      const vehicleType = await this.vehicleTypeModel.findById(
        dto.vehicleTypeId,
      );

      if (!vehicleType || vehicleType.status !== 'Active') {
        return new ApiResponse(404, {}, Msg.VEHICLE_TYPE_NOT_FOUND);
      }

      const promoCheck = await this.resolvePromo(dto.promoCode);

      if (dto.promoCode && !promoCheck.promo) {
        return new ApiResponse(400, {}, promoCheck.error || Msg.PROMO_INVALID);
      }

      const nextOccurrenceAt = this.nextOccurrenceFor(
        {
          daysOfWeek,
          pickupTime: dto.pickupTime,
          startDate,
          endDate,
        },
        new Date(),
      );

      // Nothing to run in the coming year, so the series would never book.
      if (!nextOccurrenceAt) {
        return new ApiResponse(400, {}, Msg.RECURRING_NO_OCCURRENCE);
      }

      const series = await this.recurringModel.create({
        user: user.id,
        companyId: user.companyId || null,
        vehicleTypeId: String((vehicleType as any)._id),
        vehicleTypeName: vehicleType.name,
        pickup: this.locationPayload(dto.pickup),
        dropoff: this.locationPayload(dto.dropoff),
        daysOfWeek,
        pickupTime: dto.pickupTime,
        startDate: this.startOfDay(startDate),
        endDate: endDate ? this.endOfDay(endDate) : null,
        passengerCount: dto.passengerCount || 1,
        paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
        notes: dto.notes || null,
        promoCode: promoCheck.promo ? promoCheck.promo.code : null,
        status: RecurringStatus.ACTIVE,
        nextOccurrenceAt,
      });

      return new ApiResponse(
        200,
        this.recurringPayload(series),
        Msg.RECURRING_RIDE_CREATED,
      );
    } catch (error) {
      console.error('Error while creating recurring ride:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async myRecurringRides(user: any, query: MyRecurringRidesQueryDto) {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;

      const filter: any = { user: user.id };

      if (query.status) {
        filter.status = query.status;
      }

      const [items, total] = await Promise.all([
        this.recurringModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        this.recurringModel.countDocuments(filter),
      ]);

      return new ApiResponse(
        200,
        {
          items: items.map((series) => this.recurringPayload(series)),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
        Msg.RECURRING_RIDES_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching recurring rides:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async recurringRideDetails(user: any, recurringId: string) {
    try {
      const series = await this.findRecurringRide(user, recurringId);

      if (!series) {
        return new ApiResponse(404, {}, Msg.RECURRING_RIDE_NOT_FOUND);
      }

      const rides = await this.rideModel
        .find({
          recurringId: String(series._id),
          status: {
            $nin: [RideStatus.RIDE_COMPLETED, RideStatus.RIDE_CANCELLED],
          },
        })
        .sort({ scheduledAt: 1 })
        .limit(20);

      return new ApiResponse(
        200,
        {
          ...this.recurringPayload(series),
          upcomingRides: rides.map((ride) => this.rideSummary(ride)),
        },
        Msg.RECURRING_RIDE_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching recurring ride details:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // The template and the pattern can be changed, rides that are already
  // created stay as they are. The next pickup is looked up again, so the
  // scheduler picks the change up on its next run.
  async updateRecurringRide(
    user: any,
    recurringId: string,
    dto: UpdateRecurringRideDto,
  ) {
    try {
      const series = await this.findRecurringRide(user, recurringId);

      if (!series) {
        return new ApiResponse(404, {}, Msg.RECURRING_RIDE_NOT_FOUND);
      }

      if (series.status === RecurringStatus.CANCELLED) {
        return new ApiResponse(400, {}, Msg.RECURRING_ALREADY_CANCELLED);
      }

      const daysOfWeek =
        dto.daysOfWeek !== undefined
          ? this.cleanDaysOfWeek(dto.daysOfWeek)
          : series.daysOfWeek;

      if (!daysOfWeek.length) {
        return new ApiResponse(400, {}, Msg.RECURRING_DAYS_REQUIRED);
      }

      const pickupTime = dto.pickupTime ?? series.pickupTime;

      if (!this.parsePickupTime(pickupTime)) {
        return new ApiResponse(400, {}, Msg.RECURRING_TIME_INVALID);
      }

      const startDate =
        dto.startDate !== undefined
          ? new Date(dto.startDate)
          : series.startDate;

      if (Number.isNaN(new Date(startDate).getTime())) {
        return new ApiResponse(400, {}, Msg.RECURRING_DATE_INVALID);
      }

      // A null end date makes the series open ended again.
      let endDate: Date | null = series.endDate || null;

      if (dto.endDate !== undefined) {
        endDate = dto.endDate === null ? null : new Date(dto.endDate);

        if (endDate && Number.isNaN(endDate.getTime())) {
          return new ApiResponse(400, {}, Msg.RECURRING_DATE_INVALID);
        }
      }

      if (
        endDate &&
        this.endOfDay(endDate).getTime() < this.startOfDay(startDate).getTime()
      ) {
        return new ApiResponse(400, {}, Msg.RECURRING_DATE_RANGE_INVALID);
      }

      if (dto.vehicleTypeId !== undefined) {
        if (!Types.ObjectId.isValid(dto.vehicleTypeId)) {
          return new ApiResponse(404, {}, Msg.VEHICLE_TYPE_NOT_FOUND);
        }

        const vehicleType = await this.vehicleTypeModel.findById(
          dto.vehicleTypeId,
        );

        if (!vehicleType || vehicleType.status !== 'Active') {
          return new ApiResponse(404, {}, Msg.VEHICLE_TYPE_NOT_FOUND);
        }

        series.vehicleTypeId = String((vehicleType as any)._id);
        series.vehicleTypeName = vehicleType.name;
      }

      if (dto.promoCode !== undefined) {
        const promoCheck = await this.resolvePromo(dto.promoCode);

        if (dto.promoCode && !promoCheck.promo) {
          return new ApiResponse(
            400,
            {},
            promoCheck.error || Msg.PROMO_INVALID,
          );
        }

        series.promoCode = promoCheck.promo ? promoCheck.promo.code : null;
      }

      if (dto.pickup) {
        series.pickup = this.locationPayload(dto.pickup);
      }

      if (dto.dropoff) {
        series.dropoff = this.locationPayload(dto.dropoff);
      }

      if (dto.passengerCount !== undefined) {
        series.passengerCount = dto.passengerCount;
      }

      if (dto.paymentMethod !== undefined) {
        series.paymentMethod = dto.paymentMethod;
      }

      if (dto.notes !== undefined) {
        series.notes = dto.notes || null;
      }

      series.daysOfWeek = daysOfWeek;
      series.pickupTime = pickupTime;
      series.startDate = this.startOfDay(startDate);
      series.endDate = endDate ? this.endOfDay(endDate) : null;

      if (series.status === RecurringStatus.ACTIVE) {
        series.nextOccurrenceAt = await this.nextFreeOccurrence(
          series,
          new Date(),
        );
      }

      await series.save();

      return new ApiResponse(
        200,
        this.recurringPayload(series),
        Msg.RECURRING_RIDE_UPDATED,
      );
    } catch (error) {
      console.error('Error while updating recurring ride:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // PAUSE holds the series, ACTIVE resumes it from the next pickup and
  // CANCELLED closes it for good.
  async updateRecurringRideStatus(
    user: any,
    recurringId: string,
    dto: UpdateRecurringRideStatusDto,
  ) {
    try {
      const series = await this.findRecurringRide(user, recurringId);

      if (!series) {
        return new ApiResponse(404, {}, Msg.RECURRING_RIDE_NOT_FOUND);
      }

      if (series.status === RecurringStatus.CANCELLED) {
        return new ApiResponse(400, {}, Msg.RECURRING_ALREADY_CANCELLED);
      }

      series.status = dto.status;

      if (dto.status === RecurringStatus.ACTIVE) {
        // A pause never replays the pickups that were missed, the next one is
        // looked up from now.
        const nextOccurrenceAt = await this.nextFreeOccurrence(
          series,
          new Date(),
        );

        if (!nextOccurrenceAt) {
          return new ApiResponse(400, {}, Msg.RECURRING_NO_OCCURRENCE);
        }

        series.nextOccurrenceAt = nextOccurrenceAt;
        await series.save();
      } else if (dto.status === RecurringStatus.PAUSED) {
        series.nextOccurrenceAt = null;
        await series.save();
      } else {
        series.cancelReason = dto.reason || null;
        series.cancelledAt = new Date();
        series.nextOccurrenceAt = null;
        await series.save();

        // Rides of the series that are not dispatched yet are closed with it,
        // so a cancelled series never books again.
        const pending = await this.rideModel.find({
          recurringId: String(series._id),
          status: RideStatus.SCHEDULED,
        });

        for (const ride of pending) {
          ride.status = RideStatus.RIDE_CANCELLED;
          ride.cancelledBy = CancelledBy.USER;
          ride.cancelReason = dto.reason || null;
          ride.cancelledAt = new Date();
          await ride.save();

          this.socketService.emitToRide(
            String(ride._id),
            RIDE_EVENTS.CANCELLED,
            {
              rideId: String(ride._id),
              status: ride.status,
              reason: ride.cancelReason,
              cancelledBy: ride.cancelledBy,
              cancelledAt: ride.cancelledAt,
            },
          );
        }
      }

      return new ApiResponse(
        200,
        this.recurringPayload(series),
        Msg.RECURRING_RIDE_STATUS_UPDATED,
      );
    } catch (error) {
      console.error('Error while updating recurring ride status:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Recurring bookings that are due get their ride created
  // ==========================================================
  // Read from the database on every run like the scheduled dispatch, so a
  // restart never drops a pickup.
  async promoteDueRecurringRides() {
    const dueBefore = new Date(
      Date.now() + RECURRING_MATERIALIZE_LEAD_MINUTES * 60 * 1000,
    );

    const due = await this.recurringModel
      .find({
        status: RecurringStatus.ACTIVE,
        nextOccurrenceAt: { $ne: null, $lte: dueBefore },
      })
      .sort({ nextOccurrenceAt: 1 })
      .limit(RECURRING_DISPATCH_BATCH_SIZE);

    let created = 0;

    for (const series of due) {
      const occurrenceAt = series.nextOccurrenceAt;

      if (!occurrenceAt) {
        continue;
      }

      const following = this.nextOccurrenceFor(
        this.recurringRule(series),
        occurrenceAt,
      );

      // Claimed first, so two scheduler runs never create the same ride twice.
      const claimed = await this.recurringModel.findOneAndUpdate(
        {
          _id: series._id,
          status: RecurringStatus.ACTIVE,
          nextOccurrenceAt: occurrenceAt,
        },
        { $set: { nextOccurrenceAt: following } },
        { new: true },
      );

      if (!claimed) {
        continue;
      }

      const ride = await this.createRecurringRideFor(claimed, occurrenceAt);

      if (!ride) {
        // The pickup is handed back, so the next run tries it again.
        await this.recurringModel.updateOne(
          { _id: claimed._id, nextOccurrenceAt: following },
          { $set: { nextOccurrenceAt: occurrenceAt } },
        );
        continue;
      }

      await this.recurringModel.updateOne(
        { _id: claimed._id },
        { $inc: { ridesCreated: 1 }, $set: { lastRideAt: new Date() } },
      );

      created += 1;
    }

    return created;
  }

  // ==========================================================
  // Nearby cabs (8 Cabs Nearby badge)
  // ==========================================================
  async nearbyCabs(_user: any, query: NearbyCabsDto) {
    try {
      const filter: any = {
        status: DriverStatus.ACTIVE,
        isOnline: true,
        currentLatitude: { $ne: null },
        currentLongitude: { $ne: null },
      };

      if (query.vehicleTypeId) {
        filter.vehicleTypeId = query.vehicleTypeId;
      }

      const drivers = await this.driverModel
        .find(filter)
        .select(
          'fullName vehicleType vehicleTypeId currentLatitude currentLongitude avatar',
        );

      const nearby = drivers
        .map((driver) => {
          const distanceKm = this.haversineKm(
            { latitude: query.lat, longitude: query.lng },
            {
              latitude: Number(driver.currentLatitude),
              longitude: Number(driver.currentLongitude),
            },
          );

          return {
            driverId: String(driver._id),
            vehicleTypeId: driver.vehicleTypeId || null,
            vehicleTypeName: driver.vehicleType || null,
            avatar: driver.avatar || null,
            distanceKm: Number(distanceKm.toFixed(2)),
            etaMinutes: Math.max(Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60), 1),
          };
        })
        .filter((driver) => driver.distanceKm <= DRIVER_SEARCH_RADIUS_KM)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      return new ApiResponse(
        200,
        {
          count: nearby.length,
          radiusKm: DRIVER_SEARCH_RADIUS_KM,
          latitude: query.lat,
          longitude: query.lng,
          drivers: nearby,
        },
        Msg.NEARBY_CABS_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching nearby cabs:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Driver live location (socket driverLocation event)
  // ==========================================================
  async updateDriverLocation(driverId: string, dto: DriverLocationDto) {
    try {
      const updatedAt = new Date();

      await this.driverModel.updateOne(
        { _id: driverId },
        {
          $set: {
            currentLatitude: dto.latitude,
            currentLongitude: dto.longitude,
            lastLocationAt: updatedAt,
          },
        },
      );

      if (!dto.rideId || !Types.ObjectId.isValid(dto.rideId)) {
        return { success: true, latitude: dto.latitude, longitude: dto.longitude };
      }

      const ride = await this.rideModel.findOne({
        _id: dto.rideId,
        driver: driverId,
      });

      if (!ride) {
        return { success: true, latitude: dto.latitude, longitude: dto.longitude };
      }

      // Before the trip starts the ETA is to the pickup, after that to the drop.
      const target: RideLocation =
        ride.status === RideStatus.RIDE_STARTED ? ride.dropoff : ride.pickup;

      const distanceKm = this.haversineKm(
        { latitude: dto.latitude, longitude: dto.longitude },
        { latitude: Number(target.latitude), longitude: Number(target.longitude) },
      );

      const etaMinutes = Math.max(
        Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60),
        1,
      );

      ride.etaMinutes = etaMinutes;
      await ride.save();

      const payload = {
        rideId: String(ride._id),
        driverId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        distanceKm: Number(distanceKm.toFixed(2)),
        etaMinutes,
        updatedAt,
      };

      this.socketService.emitToRide(
        String(ride._id),
        RIDE_EVENTS.DRIVER_LOCATION,
        payload,
      );
      this.socketService.emitToRide(String(ride._id), RIDE_EVENTS.STATUS, {
        rideId: String(ride._id),
        status: ride.status,
        etaMinutes,
      });

      return { success: true, ...payload };
    } catch (error) {
      console.error('Error while updating driver location:', error);
      return { success: false, message: Msg.SERVER_ERROR };
    }
  }

  // ==========================================================
  // Helpers
  // ==========================================================
  private async activeVehicleTypes() {
    return this.vehicleTypeModel
      .find({ status: 'Active' })
      .sort({ sortOrder: 1, createdAt: 1 });
  }

  private locationPayload(location: any): RideLocation {
    return {
      address: location.address || null,
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
    };
  }

  private toMiles(distanceKm: number) {
    return Number((distanceKm / KM_PER_MILE).toFixed(2));
  }

  private round(value: number) {
    return Number((value || 0).toFixed(2));
  }

  private haversineKm(from: any, to: any) {
    const earthRadiusKm = 6371;
    const toRad = (value: number) => (Number(value) * Math.PI) / 180;

    const dLat = toRad(Number(to.latitude) - Number(from.latitude));
    const dLon = toRad(Number(to.longitude) - Number(from.longitude));

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(Number(from.latitude))) *
        Math.cos(toRad(Number(to.latitude))) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async googleMatrixDistance(
    apiKey: string,
    pickup: any,
    dropoff: any,
  ) {
    try {
      const { data } = await axios.get(
        'https://maps.googleapis.com/maps/api/distancematrix/json',
        {
          params: {
            origins: pickup.latitude + ',' + pickup.longitude,
            destinations: dropoff.latitude + ',' + dropoff.longitude,
            key: apiKey,
          },
          timeout: 8000,
        },
      );

      const element = data?.rows?.[0]?.elements?.[0];

      if (!element || element.status !== 'OK') {
        return null;
      }

      return {
        distanceKm: element.distance.value / 1000,
        durationMinutes: element.duration.value / 60,
      };
    } catch (error) {
      console.error('Error while fetching distance from Google Maps:', error);
      return null;
    }
  }

  // Google has replaced the legacy Distance Matrix API with the Routes API, so
  // keys that only have the newer API enabled are resolved from here.
  private async googleRoutesDistance(
    apiKey: string,
    pickup: any,
    dropoff: any,
  ) {
    try {
      const { data } = await axios.post(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          origin: {
            location: {
              latLng: {
                latitude: Number(pickup.latitude),
                longitude: Number(pickup.longitude),
              },
            },
          },
          destination: {
            location: {
              latLng: {
                latitude: Number(dropoff.latitude),
                longitude: Number(dropoff.longitude),
              },
            },
          },
          travelMode: 'DRIVE',
        },
        {
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
          },
          timeout: 8000,
        },
      );

      const route = data?.routes?.[0];

      if (!route || route.distanceMeters === undefined || !route.duration) {
        return null;
      }

      return {
        distanceKm: route.distanceMeters / 1000,
        durationMinutes: Number(String(route.duration).replace('s', '')) / 60,
      };
    } catch (error) {
      console.error('Error while fetching route from Google Routes:', error);
      return null;
    }
  }

  // A key can have either the legacy Distance Matrix API or the newer Routes
  // API enabled, so both are tried before the local estimate is used.
  private async googleDistance(pickup: any, dropoff: any) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey || !pickup || !dropoff) {
      return null;
    }

    const matrix = await this.googleMatrixDistance(apiKey, pickup, dropoff);

    if (matrix) {
      return matrix;
    }

    return this.googleRoutesDistance(apiKey, pickup, dropoff);
  }

  // The app only sends the pickup and dropoff coordinates. The distance, the
  // duration and the source of the route are always resolved here.
  private async resolveDistance(pickup: any, dropoff: any) {
    const hasCoordinates =
      pickup?.latitude !== null &&
      pickup?.latitude !== undefined &&
      pickup?.longitude !== null &&
      pickup?.longitude !== undefined &&
      dropoff?.latitude !== null &&
      dropoff?.latitude !== undefined &&
      dropoff?.longitude !== null &&
      dropoff?.longitude !== undefined;

    if (!hasCoordinates) {
      return {
        distanceKm: null as number | null,
        durationMinutes: null as number | null,
        routeSource: null as string | null,
        routeError: Msg.ROUTE_COORDINATES_MISSING as string | null,
      };
    }

    // The distance, the duration and the fare always come from Google. A local
    // estimate is never charged, so a failed lookup is reported to the app.
    const route = await this.googleDistance(pickup, dropoff);

    if (!route) {
      console.error('Google distance lookup failed for this trip');

      return {
        distanceKm: null as number | null,
        durationMinutes: null as number | null,
        routeSource: null as string | null,
        routeError: Msg.ROUTE_DISTANCE_UNAVAILABLE as string | null,
      };
    }

    return {
      distanceKm: Number(route.distanceKm.toFixed(2)),
      durationMinutes: Number(route.durationMinutes.toFixed(2)),
      routeSource: 'GOOGLE_MAPS',
      routeError: null as string | null,
    };
  }

  private calculateFare(
    vehicleType: VehicleTypeDocument,
    pricing: any,
    options: {
      distanceKm: number;
      durationMinutes: number;
      promo?: PromoDocument | null;
    },
  ): RideFareBreakdown {
    const fareRules = pricing?.fareRules || {};

    const basePrice = Number(
      vehicleType.basePrice ?? fareRules.baseFare ?? 0,
    );
    const perKmRate = Number(vehicleType.perKmRate ?? fareRules.perKmRate ?? 0);
    const perMinuteRate = Number(
      vehicleType.perMinuteRate ?? fareRules.perMinuteRate ?? 0,
    );
    const minimumFare = Number(fareRules.minimumFare ?? basePrice);

    const distanceRate = this.round(perKmRate * options.distanceKm);
    const timeRate = this.round(perMinuteRate * options.durationMinutes);
    const subTotal = this.round(basePrice + distanceRate + timeRate);
    const discount = this.round(
      this.promoDiscount(options.promo, subTotal),
    );
    const taxable = Math.max(subTotal - discount, 0);
    const taxAndFees = 0;
    const rawTotal = taxable + taxAndFees;
    const totalFare = this.round(Math.max(rawTotal, minimumFare));

    return {
      basePrice: this.round(basePrice),
      perKmRate,
      perMinuteRate,
      distanceKm: Number(options.distanceKm.toFixed(2)),
      distanceMiles: this.toMiles(options.distanceKm),
      durationMinutes: Math.round(options.durationMinutes),
      distanceRate,
      timeRate,
      subTotal,
      discount,
      taxAndFees,
      totalFare,
      payableFare: totalFare,
      currency: DEFAULT_CURRENCY,
    };
  }

  private promoDiscount(promo: any, subTotal: number) {
    if (!promo) {
      return 0;
    }

    if (promo.type === PromoType.FLAT) {
      return Math.min(Number(promo.value), subTotal);
    }

    const percentDiscount = (subTotal * Number(promo.value)) / 100;
    const maxDiscount = promo.maxDiscount;

    if (maxDiscount === null || maxDiscount === undefined) {
      return percentDiscount;
    }

    return Math.min(percentDiscount, Number(maxDiscount));
  }

  private async resolvePromo(code?: string) {
    const cleaned = (code || '').trim().toUpperCase();

    if (!cleaned) {
      return { promo: null as PromoDocument | null, error: null as string | null };
    }

    const promo = await this.promoModel.findOne({ code: cleaned });

    if (!promo || !promo.isActive) {
      return { promo: null, error: Msg.PROMO_INVALID };
    }

    if (promo.expiresAt && new Date(promo.expiresAt).getTime() <= Date.now()) {
      return { promo: null, error: Msg.PROMO_EXPIRED };
    }

    if (
      promo.usageLimit !== null &&
      promo.usageLimit !== undefined &&
      promo.usedCount >= promo.usageLimit
    ) {
      return { promo: null, error: Msg.PROMO_USAGE_LIMIT };
    }

    return { promo, error: null };
  }

  private promoPayload(promo: any) {
    return {
      code: promo.code,
      title: promo.title || null,
      type: promo.type,
      value: promo.value,
      maxDiscount: promo.maxDiscount ?? null,
      minFare: promo.minFare || 0,
      expiresAt: promo.expiresAt || null,
    };
  }

  private vehicleTypePayload(ride: any, vehicleType?: any) {
    if (vehicleType) {
      return {
        vehicleTypeId: String(vehicleType._id),
        name: vehicleType.name,
        seats: vehicleType.seats,
        badge: vehicleType.badge || null,
        etaText: vehicleType.etaText || null,
        image: vehicleType.image || null,
        description: vehicleType.description || null,
      };
    }

    return {
      vehicleTypeId: ride.vehicleTypeId,
      name: ride.vehicleTypeName || null,
      seats: null,
      badge: null,
      etaText: null,
      image: null,
      description: null,
    };
  }

  private rideSummary(ride: any, vehicleType?: any, driver?: any) {
    return {
      rideId: String(ride._id),
      status: ride.status,
      otp: ride.otp || null,
      vehicleType: this.vehicleTypePayload(ride, vehicleType),
      pickup: ride.pickup,
      dropoff: ride.dropoff,
      distanceKm: ride.distanceKm,
      distanceMiles: this.toMiles(ride.distanceKm || 0),
      durationMinutes: ride.durationMinutes,
      etaMinutes: ride.etaMinutes,
      routeSource: ride.routeSource || null,
      fare: ride.fare,
      totalFare: ride.totalFare,
      payableFare: ride.payableFare,
      promoCode: ride.promoCode || null,
      discount: ride.discount || 0,
      passengerCount: ride.passengerCount,
      rideType: ride.rideType,
      scheduledAt: ride.scheduledAt || null,
      recurringId: ride.recurringId || null,
      paymentMethod: ride.paymentMethod,
      paymentStatus: ride.paymentStatus,
      notes: ride.notes || null,
      cancelledBy: ride.cancelledBy || null,
      cancelReason: ride.cancelReason || null,
      driver: driver ? this.driverPayload(driver) : null,
      createdAt: ride.createdAt || null,
      driverAssignedAt: ride.driverAssignedAt || null,
      startedAt: ride.startedAt || null,
      completedAt: ride.completedAt || null,
      cancelledAt: ride.cancelledAt || null,
    };
  }

  private driverPayload(driver: any) {
    return {
      driverId: String(driver._id),
      fullName: driver.fullName,
      phoneNumber: driver.phoneNumber,
      avatar: driver.avatar || null,
      rating: driver.rating ?? null,
      vehicleType: driver.vehicleType || null,
      vehicleRegistrationNumber: driver.vehicleRegistrationNumber || null,
      make: driver.make || null,
      modelAndYear: driver.modelAndYear || null,
      currentLatitude: driver.currentLatitude ?? null,
      currentLongitude: driver.currentLongitude ?? null,
      lastLocationAt: driver.lastLocationAt || null,
    };
  }

  private async rideDetailsPayload(ride: any) {
    const driver = ride.driver
      ? await this.driverModel.findById(ride.driver)
      : null;

    const vehicleType = ride.vehicleTypeId
      ? await this.vehicleTypeModel.findById(ride.vehicleTypeId)
      : null;

    return this.rideSummary(ride, vehicleType, driver);
  }

  private notifyDrivers(summary: any) {
    this.socketService.emitToDrivers(
      RIDE_EVENTS.REQUEST,
      summary,
      summary?.vehicleType?.vehicleTypeId,
    );
  }

  // ==========================================================
  // Driver side (/driver-ride/*)
  // ==========================================================

  // ==========================================================
  // Home screen: duty switch, active vehicle, stats, running ride
  // ==========================================================
  async home(driverId: string) {
    try {
      const driver = await this.driverModel.findById(driverId);

      if (!driver) {
        return new ApiResponse(404, {}, Msg.DRIVER_NOT_FOUND);
      }

      const vehicleType = await this.vehicleTypeForDriver(driver);
      const runningRide = await this.findRunningRide(driverId);

      return new ApiResponse(
        200,
        {
          driver: this.driverProfile(driver),
          vehicleType: vehicleType ? this.vehicleTypeCard(vehicleType) : null,
          duty: this.dutyPayload(driver),
          stats: await this.driverStats(driver),
          activeRide: runningRide ? await this.ridePayload(runningRide) : null,
        },
        Msg.DRIVER_HOME_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching driver home:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Dashboard tab: greeting, active vehicle, performance, today's analytics
  // ==========================================================
  async dashboard(driverId: string) {
    try {
      const driver = await this.driverModel.findById(driverId);

      if (!driver) {
        return new ApiResponse(404, {}, Msg.DRIVER_NOT_FOUND);
      }

      await this.healOnlineSession(driver);

      const now = new Date();

      const [vehicleType, runningRide, stats, today] = await Promise.all([
        this.vehicleTypeForDriver(driver),
        this.findRunningRide(driverId),
        this.driverStats(driver),
        this.todayAnalytics(driverId, now),
      ]);

      const onlineSeconds = this.onlineSecondsToday(driver, now);

      return new ApiResponse(
        200,
        {
          greeting: this.greetingFor(driver, now),
          driver: this.driverProfile(driver),
          duty: this.dutyPayload(driver),
          activeVehicle: this.activeVehicleCard(driver, vehicleType),
          performance: {
            // A rejected request is not stored yet, so the accept rate is the
            // share of the assigned rides that the driver did not cancel.
            acceptRate: stats.acceptRate,
            cancellationRate: stats.cancellationRate,
            completedTrips: stats.totalTrips,
            cancelledRides: stats.cancellations,
          },
          today: {
            ...today,
            rating: driver.rating ?? null,
            onlineSeconds,
            onlineMinutes: Math.floor(onlineSeconds / 60),
            onlineDurationText: this.onlineDurationText(onlineSeconds),
          },
          currency: DEFAULT_CURRENCY,
          activeRide: runningRide ? await this.ridePayload(runningRide) : null,
        },
        Msg.DRIVER_DASHBOARD_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching driver dashboard:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Duty (Go online / Go offline)
  // ==========================================================
  async setDuty(driverId: string, dto: DriverDutyDto) {
    try {
      const driver = await this.driverModel.findById(driverId);

      if (!driver) {
        return new ApiResponse(404, {}, Msg.DRIVER_NOT_FOUND);
      }

      if (DRIVER_BLOCKED_STATUSES.includes(driver.status)) {
        return new ApiResponse(403, {}, Msg.DRIVER_NOT_AVAILABLE);
      }

      const vehicleType = await this.vehicleTypeForDriver(driver);

      if (dto.isOnline && !vehicleType) {
        return new ApiResponse(400, {}, Msg.DRIVER_VEHICLE_NOT_SET);
      }

      if (!dto.isOnline && (await this.findRunningRide(driverId))) {
        return new ApiResponse(400, {}, Msg.DRIVER_GO_OFFLINE_BLOCKED);
      }

      // Duty time of the day is banked on every switch, so the dashboard can
      // show the online hours of today. The open session counts live from
      // onlineSince until the driver goes offline again. A driver who came
      // online before this tracking existed gets his session opened here.
      if (dto.isOnline) {
        if (!driver.onlineSince) {
          driver.onlineSince = new Date();
        }
      } else if (driver.isOnline) {
        this.closeOnlineSession(driver);
      }

      driver.isOnline = dto.isOnline;
      await driver.save();

      // The request pool follows the duty switch, so the driver stops getting
      // ride requests the moment he goes offline and starts again on online.
      this.socketService.syncDriverPoolRooms(
        driverId,
        dto.isOnline,
        vehicleType?._id,
      );

      return new ApiResponse(
        200,
        {
          duty: this.dutyPayload(driver),
          stats: await this.driverStats(driver),
        },
        Msg.DRIVER_DUTY_UPDATED,
      );
    } catch (error) {
      console.error('Error while updating driver duty:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Live location (REST fallback of the socket driverLocation event)
  // ==========================================================
  async updateLocation(driverId: string, dto: DriverLocationDto) {
    try {
      const driver = await this.driverModel.findById(driverId);

      if (!driver) {
        return new ApiResponse(404, {}, Msg.DRIVER_NOT_FOUND);
      }

      const result: any = await this.updateDriverLocation(
        driverId,
        dto,
      );

      if (!result?.success) {
        return new ApiResponse(400, {}, result?.message || Msg.SERVER_ERROR);
      }

      return new ApiResponse(200, result, Msg.DRIVER_LOCATION_UPDATED);
    } catch (error) {
      console.error('Error while updating driver location:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // New ride requests (New Ride Request screen + request list)
  // ==========================================================
  async requests(driverId: string) {
    try {
      const gate: any = await this.requireOnlineDriver(driverId);

      if (gate.error) {
        return gate.error;
      }

      const { driver } = gate;

      if (await this.findRunningRide(driverId)) {
        return new ApiResponse(400, {}, Msg.DRIVER_BUSY);
      }

      const vehicleType = await this.vehicleTypeForDriver(driver);

      if (!vehicleType) {
        return new ApiResponse(400, {}, Msg.DRIVER_VEHICLE_NOT_SET);
      }

      const rides = await this.rideModel
        .find({
          status: RideStatus.SEARCHING_DRIVER,
          vehicleTypeId: String(vehicleType._id),
        })
        .sort({ createdAt: -1 })
        .limit(DRIVER_REQUEST_LIMIT);

      const passengers = await this.passengersFor(rides);

      const requests = rides
        .map((ride) =>
          this.requestPayload(ride, passengers.get(String(ride.user)), driver),
        )
        .filter(
          (request: any) =>
            request.distanceToPickupKm === null ||
            request.distanceToPickupKm <= DRIVER_SEARCH_RADIUS_KM,
        )
        .sort(
          (a: any, b: any) =>
            (a.distanceToPickupKm ?? 0) - (b.distanceToPickupKm ?? 0),
        );

      return new ApiResponse(
        200,
        {
          count: requests.length,
          radiusKm: DRIVER_SEARCH_RADIUS_KM,
          vehicleTypeId: String(vehicleType._id),
          requests,
        },
        Msg.RIDE_REQUESTS_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching ride requests:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async requestDetails(driverId: string, rideId: string) {
    try {
      const gate: any = await this.requireOnlineDriver(driverId);

      if (gate.error) {
        return gate.error;
      }

      if (!Types.ObjectId.isValid(rideId)) {
        return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
      }

      const ride = await this.rideModel.findOne({
        _id: rideId,
        status: RideStatus.SEARCHING_DRIVER,
      });

      if (!ride) {
        return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
      }

      const { driver } = gate;
      const vehicleType = await this.vehicleTypeForDriver(driver);

      if (!vehicleType) {
        return new ApiResponse(400, {}, Msg.DRIVER_VEHICLE_NOT_SET);
      }

      if (String(vehicleType._id) !== ride.vehicleTypeId) {
        return new ApiResponse(400, {}, Msg.DRIVER_VEHICLE_TYPE_MISMATCH);
      }

      const passenger = await this.userModel.findById(ride.user);

      return new ApiResponse(
        200,
        this.requestPayload(ride, passenger, driver),
        Msg.RIDE_REQUEST_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching ride request details:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Accept (Slide to Accept)
  // ==========================================================
  async accept(driverId: string, dto: DriverRideIdDto) {
    try {
      const gate: any = await this.requireOnlineDriver(driverId);

      if (gate.error) {
        return gate.error;
      }

      const { driver } = gate;

      if (await this.findRunningRide(driverId)) {
        return new ApiResponse(400, {}, Msg.DRIVER_BUSY);
      }

      if (!Types.ObjectId.isValid(dto.rideId)) {
        return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
      }

      const ride = await this.rideModel.findById(dto.rideId);

      if (!ride) {
        return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
      }

      if (ride.status !== RideStatus.SEARCHING_DRIVER) {
        return new ApiResponse(400, {}, Msg.RIDE_ALREADY_TAKEN);
      }

      const vehicleType = await this.vehicleTypeForDriver(driver);

      if (!vehicleType) {
        return new ApiResponse(400, {}, Msg.DRIVER_VEHICLE_NOT_SET);
      }

      if (String(vehicleType._id) !== ride.vehicleTypeId) {
        return new ApiResponse(400, {}, Msg.DRIVER_VEHICLE_TYPE_MISMATCH);
      }

      // Atomic claim so two drivers can never take the same ride.
      const claimed = await this.rideModel.findOneAndUpdate(
        {
          _id: ride._id,
          status: RideStatus.SEARCHING_DRIVER,
          driver: null,
        },
        {
          $set: {
            driver: driverId,
            status: RideStatus.DRIVER_ASSIGNED,
            driverAssignedAt: new Date(),
            companyId: ride.companyId || driver.companyId || null,
          },
        },
        { new: true },
      );

      if (!claimed) {
        return new ApiResponse(400, {}, Msg.RIDE_ALREADY_TAKEN);
      }

      await this.driverModel.updateOne(
        { _id: driverId },
        { $set: { status: DriverStatus.ON_RIDE } },
      );

      await this.socketService.joinActorToRide(driverId, String(claimed._id));

      const payload = await this.ridePayload(claimed);

      this.emitRideEvent(
        claimed,
        RIDE_EVENTS.DRIVER,
        await this.driverEventPayload(claimed),
      );
      this.emitRideEvent(
        claimed,
        RIDE_EVENTS.STATUS,
        this.statusPayload(claimed, driverId),
      );
      this.socketService.emitToDrivers(
        RIDE_EVENTS.TAKEN,
        {
          rideId: String(claimed._id),
          status: claimed.status,
          driverId,
        },
        claimed.vehicleTypeId,
      );

      return new ApiResponse(200, payload, Msg.RIDE_ACCEPTED);
    } catch (error) {
      console.error('Error while accepting ride:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Reached pickup (Waiting for Rider)
  // ==========================================================
  async arrived(driverId: string, dto: DriverRideIdDto) {
    try {
      const found: any = await this.driverRideOrError(driverId, dto.rideId);

      if (found.error) {
        return found.error;
      }

      const { ride } = found;

      if (
        ride.status !== RideStatus.DRIVER_ASSIGNED &&
        ride.status !== RideStatus.DRIVER_ARRIVED
      ) {
        return this.rideStatusError(ride);
      }

      ride.status = RideStatus.DRIVER_ARRIVED;
      await ride.save();

      this.emitRideEvent(
        ride,
        RIDE_EVENTS.STATUS,
        this.statusPayload(ride, driverId),
      );

      return new ApiResponse(
        200,
        await this.ridePayload(ride),
        Msg.DRIVER_ARRIVED,
      );
    } catch (error) {
      console.error('Error while marking driver arrived:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Start trip (Start Trip button, passenger OTP optional)
  // ==========================================================
  async start(driverId: string, dto: DriverStartRideDto) {
    try {
      const found: any = await this.driverRideOrError(driverId, dto.rideId);

      if (found.error) {
        return found.error;
      }

      const { ride } = found;

      // The driver has to mark arrival first, only then the trip can start.
      if (ride.status !== RideStatus.DRIVER_ARRIVED) {
        if (ride.status === RideStatus.DRIVER_ASSIGNED) {
          return new ApiResponse(400, {}, Msg.RIDE_NOT_ARRIVED);
        }
        return this.rideStatusError(ride);
      }

      if (dto.otp && ride.otp && dto.otp !== ride.otp) {
        return new ApiResponse(400, {}, Msg.OTP_INVALID);
      }

      ride.status = RideStatus.RIDE_STARTED;
      ride.startedAt = new Date();
      await ride.save();

      this.emitRideEvent(
        ride,
        RIDE_EVENTS.STATUS,
        this.statusPayload(ride, driverId),
      );

      return new ApiResponse(
        200,
        await this.ridePayload(ride),
        Msg.RIDE_STARTED,
      );
    } catch (error) {
      console.error('Error while starting ride:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // End trip (End Trip button -> Trip Completed screen)
  // ==========================================================
  async complete(driverId: string, dto: DriverRideIdDto) {
    try {
      const found: any = await this.driverRideOrError(driverId, dto.rideId);

      if (found.error) {
        return found.error;
      }

      const { ride } = found;

      if (ride.status !== RideStatus.RIDE_STARTED) {
        if (
          ride.status === RideStatus.DRIVER_ASSIGNED ||
          ride.status === RideStatus.DRIVER_ARRIVED
        ) {
          return new ApiResponse(400, {}, Msg.RIDE_NOT_STARTED);
        }
        return this.rideStatusError(ride);
      }

      const completedAt = new Date();

      ride.status = RideStatus.RIDE_COMPLETED;
      ride.completedAt = completedAt;

      // Card and wallet rides are charged automatically, cash is collected by
      // the driver from the fare screen.
      if (ride.paymentMethod !== PaymentMethod.CASH) {
        ride.paymentStatus = PaymentStatus.PAID;
        ride.paymentCollectedAt = completedAt;
      }

      await ride.save();

      await this.driverModel.updateOne(
        { _id: driverId },
        { $set: { status: DriverStatus.ACTIVE } },
      );

      const payload = await this.ridePayload(ride);

      this.emitRideEvent(ride, RIDE_EVENTS.COMPLETED, payload);
      this.emitRideEvent(
        ride,
        RIDE_EVENTS.STATUS,
        this.statusPayload(ride, driverId),
      );
      this.socketService.leaveRideRoom(String(ride._id));

      return new ApiResponse(200, payload, Msg.RIDE_COMPLETED);
    } catch (error) {
      console.error('Error while completing ride:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Collect payment (Collect Payment button on the fare screen)
  // ==========================================================
  async collectPayment(driverId: string, dto: DriverCollectPaymentDto) {
    try {
      const found: any = await this.driverRideOrError(driverId, dto.rideId);

      if (found.error) {
        return found.error;
      }

      const { ride } = found;

      if (ride.status !== RideStatus.RIDE_COMPLETED) {
        return ride.status === RideStatus.RIDE_CANCELLED
          ? this.rideStatusError(ride)
          : new ApiResponse(400, {}, Msg.RIDE_NOT_COMPLETED);
      }

      if (ride.paymentStatus === PaymentStatus.PAID) {
        return new ApiResponse(400, {}, Msg.PAYMENT_ALREADY_COMPLETED);
      }

      ride.paymentStatus = PaymentStatus.PAID;
      ride.paymentCollectedAt = new Date();

      if (dto.paymentMethod) {
        ride.paymentMethod = dto.paymentMethod;
      }

      await ride.save();

      const payload = await this.ridePayload(ride);

      this.emitRideEvent(ride, RIDE_EVENTS.PAYMENT, payload);

      return new ApiResponse(200, payload, Msg.PAYMENT_COLLECTED);
    } catch (error) {
      console.error('Error while collecting payment:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Driver cancels the ride (before the trip starts)
  // ==========================================================
  async driverCancelRide(driverId: string, dto: DriverCancelRideDto) {
    try {
      const found: any = await this.driverRideOrError(driverId, dto.rideId);

      if (found.error) {
        return found.error;
      }

      const { ride } = found;

      if (!DRIVER_CANCELLABLE_STATUSES.includes(ride.status)) {
        return new ApiResponse(400, {}, Msg.RIDE_CANNOT_CANCEL);
      }

      ride.status = RideStatus.RIDE_CANCELLED;
      ride.cancelledBy = CancelledBy.DRIVER;
      ride.cancelReason = dto.reason || null;
      ride.cancelledAt = new Date();
      await ride.save();

      await this.driverModel.updateOne(
        { _id: driverId },
        { $set: { status: DriverStatus.ACTIVE } },
      );

      const payload = await this.ridePayload(ride);

      this.emitRideEvent(ride, RIDE_EVENTS.CANCELLED, {
        rideId: String(ride._id),
        status: ride.status,
        reason: ride.cancelReason,
        cancelledBy: ride.cancelledBy,
        cancelledAt: ride.cancelledAt,
      });
      this.emitRideEvent(
        ride,
        RIDE_EVENTS.STATUS,
        this.statusPayload(ride, driverId),
      );
      this.socketService.leaveRideRoom(String(ride._id));

      return new ApiResponse(200, payload, Msg.RIDE_CANCELLED);
    } catch (error) {
      console.error('Error while cancelling ride as driver:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Running ride of the driver (app resume + socket rejoin)
  // ==========================================================
  async driverActiveRide(driverId: string) {
    try {
      const ride = await this.findRunningRide(driverId);

      if (!ride) {
        return new ApiResponse(200, null, Msg.NO_ACTIVE_TRIP);
      }

      return new ApiResponse(
        200,
        await this.ridePayload(ride),
        Msg.RIDE_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching driver active ride:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // Used by the socket gateway so a reconnecting driver lands in the room of
  // the ride that is running right now.
  async activeRideIdForDriver(driverId: string) {
    try {
      const ride = await this.rideModel
        .findOne({
          driver: driverId,
          status: { $in: DRIVER_RUNNING_STATUSES },
        })
        .sort({ createdAt: -1 })
        .select('_id');

      return ride ? String(ride._id) : null;
    } catch (error) {
      console.error('Error while looking up the driver active ride:', error);
      return null;
    }
  }

  // Socket rooms of one driver: the shared pool and his own vehicle type room.
  async socketRoomsForDriver(driverId: string) {
    const driver = await this.driverModel.findById(driverId);

    // The duty switch decides who may receive a ride request, so an offline
    // driver stays out of the pool rooms even when his socket is connected.
    if (!driver || !driver.isOnline) {
      return [];
    }

    const vehicleType = await this.vehicleTypeForDriver(driver);

    return this.socketService.driverPoolRooms(vehicleType?._id);
  }
  // ==========================================================
  // Trips tab
  // ==========================================================
  async history(driverId: string, query: DriverRideHistoryQueryDto) {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;

      const filter: any = { driver: driverId };

      if (query.status) {
        filter.status = query.status;
      }

      const [items, total] = await Promise.all([
        this.rideModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        this.rideModel.countDocuments(filter),
      ]);

      const passengers = await this.passengersFor(items);

      return new ApiResponse(
        200,
        {
          items: items.map((ride) =>
            this.ridePayloadWith(ride, passengers.get(String(ride.user))),
          ),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
        Msg.RIDES_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching driver ride history:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async driverRideDetails(driverId: string, rideId: string) {
    try {
      if (!Types.ObjectId.isValid(rideId)) {
        return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
      }

      const ride = await this.rideModel.findOne({
        _id: rideId,
        driver: driverId,
      });

      if (!ride) {
        return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
      }

      return new ApiResponse(
        200,
        await this.ridePayload(ride),
        Msg.RIDE_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching driver ride details:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Earnings tab
  // ==========================================================
  async earnings(driverId: string, query: DriverEarningsQueryDto) {
    try {
      const driver = await this.driverModel.findById(driverId);

      if (!driver) {
        return new ApiResponse(404, {}, Msg.DRIVER_NOT_FOUND);
      }

      const range = query.range || EarningsRange.WEEK;
      const windowDays = EARNINGS_WINDOW_DAYS[range];

      const [allTime, daily] = await Promise.all([
        this.earningsTotals(driverId),
        this.dailyEarnings(driverId, 30),
      ]);

      const windowDaily = windowDays
        ? daily.filter((row) => row.date >= this.dateKey(this.daysAgo(windowDays)))
        : daily;

      const rangeTotals = windowDaily.reduce(
        (sum, row) => ({
          earned: this.round2(sum.earned + row.earned),
          trips: sum.trips + row.trips,
        }),
        { earned: 0, trips: 0 },
      );

      const rangeTrips = rangeTotals.trips;

      return new ApiResponse(
        200,
        {
          currency: DEFAULT_CURRENCY,
          range,
          rangeEarned: windowDays ? rangeTotals.earned : allTime.totalEarned,
          rangeTrips: windowDays ? rangeTrips : allTime.trips,
          totalEarned: allTime.totalEarned,
          totalTrips: allTime.trips,
          today: this.earningsForLastDays(daily, 1),
          week: this.earningsForLastDays(daily, 7),
          month: this.earningsForLastDays(daily, 30),
          daily: windowDaily,
        },
        Msg.DRIVER_EARNINGS_FETCHED,
      );
    } catch (error) {
      console.error('Error while fetching driver earnings:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================================
  // Helpers
  // ==========================================================
  private async requireOnlineDriver(driverId: string) {
    const driver = await this.driverModel.findById(driverId);

    if (!driver) {
      return { error: new ApiResponse(404, {}, Msg.DRIVER_NOT_FOUND) };
    }

    if (DRIVER_BLOCKED_STATUSES.includes(driver.status)) {
      return { error: new ApiResponse(403, {}, Msg.DRIVER_NOT_AVAILABLE) };
    }

    if (!driver.isOnline) {
      return { error: new ApiResponse(400, {}, Msg.DRIVER_NOT_ONLINE) };
    }

    return { driver };
  }

  private async driverRideOrError(driverId: string, rideId: string) {
    if (!Types.ObjectId.isValid(rideId)) {
      return { error: new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND) };
    }

    const ride = await this.rideModel.findOne({
      _id: rideId,
      driver: driverId,
    });

    if (!ride) {
      return { error: new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND) };
    }

    return { ride };
  }

  private findRunningRide(driverId: string) {
    return this.rideModel
      .findOne({
        driver: driverId,
        status: { $in: DRIVER_RUNNING_STATUSES },
      })
      .sort({ createdAt: -1 });
  }

  // Live ride of one passenger: from booking until the trip is finished or
  // cancelled. A started trip still counts, so this uses ACTIVE_RIDE_STATUSES
  // and not the narrower cancellable list.
  private findActiveRide(userId: string) {
    return this.rideModel
      .findOne({
        user: userId,
        status: { $in: ACTIVE_RIDE_STATUSES },
      })
      .sort({ createdAt: -1 });
  }

  private async vehicleTypeForDriver(driver: DriverDocument) {
    if (driver.vehicleTypeId && Types.ObjectId.isValid(driver.vehicleTypeId)) {
      const byId = await this.vehicleTypeModel.findById(driver.vehicleTypeId);

      if (byId) {
        return byId;
      }
    }

    if (driver.vehicleType) {
      const byName = await this.vehicleTypeModel.findOne({
        name: driver.vehicleType,
      });

      if (byName) {
        return byName;
      }
    }

    return null;
  }

  private async passengersFor(rides: any[]) {
    const ids = rides
      .map((ride) => String(ride.user))
      .filter((id) => Types.ObjectId.isValid(id));

    const passengers = new Map<string, any>();

    if (!ids.length) {
      return passengers;
    }

    const users = await this.userModel.find({ _id: { $in: ids } });

    users.forEach((user) => passengers.set(String(user._id), user));

    return passengers;
  }

  private async driverStats(driver: DriverDocument) {
    const driverId = String(driver._id);

    const [totalTrips, cancellations, earnings] = await Promise.all([
      this.rideModel.countDocuments({
        driver: driverId,
        status: RideStatus.RIDE_COMPLETED,
      }),
      this.rideModel.countDocuments({
        driver: driverId,
        status: RideStatus.RIDE_CANCELLED,
        cancelledBy: CancelledBy.DRIVER,
      }),
      this.earningsTotals(driverId),
    ]);

    const assigned = totalTrips + cancellations;
    const cancellationRate = assigned
      ? this.round2((cancellations / assigned) * 100)
      : 0;

    return {
      totalTrips,
      cancellations,
      cancellationRate,
      acceptRate: assigned ? this.round2(100 - cancellationRate) : 100,
      rating: driver.rating ?? null,
      totalEarned: earnings.totalEarned,
      currency: DEFAULT_CURRENCY,
    };
  }

  private async earningsTotals(driverId: string) {
    const rows = await this.rideModel.aggregate([
      {
        $match: { driver: driverId, status: RideStatus.RIDE_COMPLETED },
      },
      {
        $group: {
          _id: null,
          totalEarned: { $sum: '$payableFare' },
          trips: { $sum: 1 },
        },
      },
    ]);

    return {
      totalEarned: this.round2(rows[0]?.totalEarned || 0),
      trips: rows[0]?.trips || 0,
    };
  }

  // ==========================================================
  // Duty time of the running day (dashboard online hours)
  // ==========================================================
  // Adds the still open duty session to the online seconds of the running day
  // and closes it.
  private closeOnlineSession(driver: DriverDocument, at: Date = new Date()) {
    const startedAt = driver.onlineSince;
    driver.onlineSince = null;

    if (!startedAt) {
      return;
    }

    const dayKey = this.localDateKey(at);
    const sessionSeconds = Math.max(
      0,
      Math.floor((at.getTime() - new Date(startedAt).getTime()) / 1000),
    );
    const banked =
      driver.onlineStatsDate === dayKey ? driver.onlineStatsSeconds || 0 : 0;

    driver.onlineStatsDate = dayKey;
    driver.onlineStatsSeconds = banked + sessionSeconds;
  }

  // A driver who is online but has no session start time (he came online before
  // this duty tracking existed) gets the session opened on the first dashboard
  // call, so the online hours start counting instead of staying at zero.
  private async healOnlineSession(driver: DriverDocument) {
    if (!driver.isOnline || driver.onlineSince) {
      return;
    }

    const now = new Date();
    driver.onlineSince = now;

    await this.driverModel.updateOne(
      { _id: driver._id },
      { $set: { onlineSince: now } },
    );
  }

  private onlineSecondsToday(driver: DriverDocument, now: Date) {
    const dayKey = this.localDateKey(now);
    const banked =
      driver.onlineStatsDate === dayKey ? driver.onlineStatsSeconds || 0 : 0;

    if (!driver.isOnline || !driver.onlineSince) {
      return banked;
    }

    // Only the part of the session that falls in the running day counts, so a
    // session that runs through midnight never shows more than a day.
    const dayStart = this.startOfDay(now);
    const sessionStart = new Date(driver.onlineSince);
    const from =
      sessionStart.getTime() > dayStart.getTime() ? sessionStart : dayStart;
    const running = Math.max(
      0,
      Math.floor((now.getTime() - from.getTime()) / 1000),
    );

    return banked + running;
  }

  private onlineDurationText(seconds: number) {
    const minutes = Math.floor((seconds || 0) / 60);

    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  // ==========================================================
  // Today's analytics (earnings, trips and the earnings trend)
  // ==========================================================
  private async todayAnalytics(driverId: string, now: Date) {
    const todayStart = this.startOfDay(now);
    const yesterdayStart = new Date(todayStart.getTime() - DAY_IN_MS);

    const rows = await this.rideModel.aggregate([
      {
        $match: {
          driver: driverId,
          status: RideStatus.RIDE_COMPLETED,
          completedAt: { $gte: yesterdayStart },
        },
      },
      {
        $group: {
          _id: null,
          todayEarned: {
            $sum: {
              $cond: [
                { $gte: ['$completedAt', todayStart] },
                '$payableFare',
                0,
              ],
            },
          },
          todayTrips: {
            $sum: { $cond: [{ $gte: ['$completedAt', todayStart] }, 1, 0] },
          },
          yesterdayEarned: {
            $sum: {
              $cond: [{ $lt: ['$completedAt', todayStart] }, '$payableFare', 0],
            },
          },
        },
      },
    ]);

    const earnings = this.round2(rows[0]?.todayEarned || 0);
    const yesterdayEarnings = this.round2(rows[0]?.yesterdayEarned || 0);
    const trend = this.trendPercent(earnings, yesterdayEarnings);

    return {
      date: this.localDateKey(now),
      earnings,
      earningsYesterday: yesterdayEarnings,
      earningsTrendPercent: trend.percent,
      earningsTrendDirection: trend.direction,
      trips: rows[0]?.todayTrips || 0,
    };
  }

  // Change of today against yesterday. Nothing earned so far today is reported
  // as flat, so the card does not show a drop on every fresh morning. With no
  // earnings yesterday any earning of today counts as a rise.
  private trendPercent(current: number, previous: number) {
    let percent = 0;

    if (current > 0) {
      percent =
        previous > 0
          ? this.round2(((current - previous) / previous) * 100)
          : 100;
    }

    let direction = 'FLAT';

    if (percent > 0) {
      direction = 'UP';
    } else if (percent < 0) {
      direction = 'DOWN';
    }

    return { percent, direction };
  }

  private greetingFor(driver: DriverDocument, now: Date) {
    const hour = now.getHours();

    let label = 'Good Evening';
    let timeOfDay = 'EVENING';

    if (hour < 12) {
      label = 'Good Morning';
      timeOfDay = 'MORNING';
    } else if (hour < 17) {
      label = 'Good Afternoon';
      timeOfDay = 'AFTERNOON';
    }

    const firstName = (driver.fullName || '').trim().split(/\s+/)[0];

    return { text: `${label}, ${firstName || 'Driver'}!`, timeOfDay };
  }

  private activeVehicleCard(driver: DriverDocument, vehicleType: any) {
    const makeAndModel = [driver.make, driver.modelAndYear]
      .filter((part) => !!part)
      .join(' ')
      .trim();

    return {
      vehicleTypeId: vehicleType
        ? String(vehicleType._id)
        : driver.vehicleTypeId || null,
      name: vehicleType ? vehicleType.name : driver.vehicleType || null,
      displayName:
        makeAndModel ||
        (vehicleType ? vehicleType.name : driver.vehicleType) ||
        driver.vehicleRegistrationNumber ||
        null,
      make: driver.make || null,
      modelAndYear: driver.modelAndYear || null,
      registrationNumber: driver.vehicleRegistrationNumber || null,
      seats: vehicleType?.seats ?? null,
      image: vehicleType?.image || null,
      isActive: !!driver.isOnline,
      status: driver.isOnline ? 'ONLINE' : 'OFFLINE',
    };
  }
  private async dailyEarnings(driverId: string, days: number) {
    const rows = await this.rideModel.aggregate([
      {
        $match: {
          driver: driverId,
          status: RideStatus.RIDE_COMPLETED,
          completedAt: { $gte: this.daysAgo(days) },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$completedAt' },
          },
          earned: { $sum: '$payableFare' },
          trips: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    return rows.map((row: any) => ({
      date: row._id,
      earned: this.round2(row.earned),
      trips: row.trips,
    }));
  }

  private earningsForLastDays(daily: any[], days: number) {
    const from = this.dateKey(this.daysAgo(days));

    return daily
      .filter((row) => row.date >= from)
      .reduce(
        (sum, row) => ({
          earned: this.round2(sum.earned + row.earned),
          trips: sum.trips + row.trips,
        }),
        { earned: 0, trips: 0 },
      );
  }

  private driverProfile(driver: DriverDocument) {
    return {
      driverId: String(driver._id),
      fullName: driver.fullName,
      phoneNumber: driver.phoneNumber,
      email: driver.email,
      avatar: driver.avatar || null,
      rating: driver.rating ?? null,
      status: driver.status,
      isOnline: !!driver.isOnline,
      isVerified: driver.isVerified,
      vehicleTypeId: driver.vehicleTypeId || null,
      vehicleType: driver.vehicleType || null,
      vehicleRegistrationNumber: driver.vehicleRegistrationNumber || null,
      make: driver.make || null,
      modelAndYear: driver.modelAndYear || null,
      fuelType: driver.fuelType || null,
      transmission: driver.transmission || null,
      currentLatitude: driver.currentLatitude ?? null,
      currentLongitude: driver.currentLongitude ?? null,
      lastLocationAt: driver.lastLocationAt || null,
    };
  }

  // Same shape the passenger app already receives for the assigned driver.
  private driverCard(driver: any) {
    return {
      driverId: String(driver._id),
      fullName: driver.fullName,
      phoneNumber: driver.phoneNumber,
      avatar: driver.avatar || null,
      rating: driver.rating ?? null,
      vehicleType: driver.vehicleType || null,
      vehicleRegistrationNumber: driver.vehicleRegistrationNumber || null,
      make: driver.make || null,
      modelAndYear: driver.modelAndYear || null,
      currentLatitude: driver.currentLatitude ?? null,
      currentLongitude: driver.currentLongitude ?? null,
      lastLocationAt: driver.lastLocationAt || null,
    };
  }

  private passengerPayload(passenger: any) {
    const fullName =
      `${passenger.firstName || ''} ${passenger.lastName || ''}`.trim();

    return {
      userId: String(passenger._id),
      fullName: fullName || passenger.email || null,
      firstName: passenger.firstName || null,
      lastName: passenger.lastName || null,
      phoneNumber: passenger.phoneNumber || null,
      avatar: passenger.avatar || null,
      rating: passenger.rating ?? null,
    };
  }

  private vehicleTypeCard(vehicleType: any) {
    return {
      vehicleTypeId: String(vehicleType._id),
      name: vehicleType.name,
      seats: vehicleType.seats,
      badge: vehicleType.badge || null,
      etaText: vehicleType.etaText || null,
      image: vehicleType.image || null,
      description: vehicleType.description || null,
      basePrice: vehicleType.basePrice ?? null,
      perKmRate: vehicleType.perKmRate ?? null,
      perMinuteRate: vehicleType.perMinuteRate ?? null,
    };
  }

  private dutyPayload(driver: DriverDocument) {
    return {
      isOnline: !!driver.isOnline,
      status: driver.status,
      currentLatitude: driver.currentLatitude ?? null,
      currentLongitude: driver.currentLongitude ?? null,
      lastLocationAt: driver.lastLocationAt || null,
    };
  }

  // Which tap the app should show next for the current status, so the
  // frontend can enable or disable its button.
  private nextActionFor(ride: any) {
    switch (ride.status) {
      case RideStatus.DRIVER_ASSIGNED:
        return 'MARK_ARRIVED';
      case RideStatus.DRIVER_ARRIVED:
        return 'START_TRIP';
      case RideStatus.RIDE_STARTED:
        return 'END_TRIP';
      case RideStatus.RIDE_COMPLETED:
        return ride.paymentStatus === PaymentStatus.PENDING &&
          ride.paymentMethod === PaymentMethod.CASH
          ? 'COLLECT_PAYMENT'
          : null;
      default:
        return null;
    }
  }

  // This action is not allowed for the current status, so answer with a clear
  // message for that status.
  private rideStatusError(ride: any) {
    if (ride.status === RideStatus.RIDE_STARTED) {
      return new ApiResponse(400, {}, Msg.RIDE_ALREADY_STARTED);
    }
    if (ride.status === RideStatus.RIDE_COMPLETED) {
      return new ApiResponse(400, {}, Msg.RIDE_ALREADY_COMPLETED);
    }
    if (ride.status === RideStatus.RIDE_CANCELLED) {
      return new ApiResponse(400, {}, Msg.RIDE_ALREADY_CANCELLED);
    }
    return new ApiResponse(400, {}, Msg.RIDE_STATUS_INVALID);
  }
  private ridePayloadWith(ride: any, passenger?: any, vehicleType?: any) {
    return {
      rideId: String(ride._id),
      status: ride.status,
      rideType: ride.rideType,
      scheduledAt: ride.scheduledAt || null,
      recurringId: ride.recurringId || null,
      pickup: ride.pickup,
      dropoff: ride.dropoff,
      distanceKm: ride.distanceKm,
      distanceMiles: this.toMiles(ride.distanceKm || 0),
      durationMinutes: ride.durationMinutes,
      etaMinutes: ride.etaMinutes,
      routeSource: ride.routeSource || null,
      fare: ride.fare,
      totalFare: ride.totalFare,
      payableFare: ride.payableFare,
      discount: ride.discount || 0,
      promoCode: ride.promoCode || null,
      passengerCount: ride.passengerCount,
      paymentMethod: ride.paymentMethod,
      paymentStatus: ride.paymentStatus,
      paymentCollectedAt: ride.paymentCollectedAt || null,
      nextAction: this.nextActionFor(ride),
      notes: ride.notes || null,
      cancelReason: ride.cancelReason || null,
      cancelledBy: ride.cancelledBy || null,
      vehicleType: vehicleType
        ? this.vehicleTypeCard(vehicleType)
        : {
            vehicleTypeId: ride.vehicleTypeId,
            name: ride.vehicleTypeName || null,
            seats: null,
            badge: null,
            etaText: null,
            image: null,
            description: null,
            basePrice: null,
            perKmRate: null,
            perMinuteRate: null,
          },
      passenger: passenger ? this.passengerPayload(passenger) : null,
      createdAt: ride.createdAt || null,
      driverAssignedAt: ride.driverAssignedAt || null,
      startedAt: ride.startedAt || null,
      completedAt: ride.completedAt || null,
      cancelledAt: ride.cancelledAt || null,
    };
  }

  private async ridePayload(ride: any) {
    const [passenger, vehicleType] = await Promise.all([
      ride.user && Types.ObjectId.isValid(String(ride.user))
        ? this.userModel.findById(ride.user)
        : null,
      ride.vehicleTypeId && Types.ObjectId.isValid(String(ride.vehicleTypeId))
        ? this.vehicleTypeModel.findById(ride.vehicleTypeId)
        : null,
    ]);

    return this.ridePayloadWith(ride, passenger, vehicleType);
  }

  private requestPayload(ride: any, passenger: any, driver: DriverDocument) {
    const distanceToPickupKm = this.distanceToPickup(driver, ride);
    const etaMinutesToPickup =
      distanceToPickupKm === null
        ? null
        : Math.max(
            Math.round((distanceToPickupKm / AVERAGE_SPEED_KMH) * 60),
            1,
          );

    return {
      ...this.ridePayloadWith(ride, passenger),
      requestedAt: ride.createdAt || null,
      distanceToPickupKm,
      etaMinutesToPickup,
      pickupDistanceText:
        etaMinutesToPickup === null ? null : `${etaMinutesToPickup} min away`,
      dropDistanceText:
        ride.distanceKm === null || ride.distanceKm === undefined
          ? null
          : `${ride.distanceKm} km away`,
    };
  }

  private distanceToPickup(driver: DriverDocument, ride: any) {
    const hasLocation =
      driver.currentLatitude !== null &&
      driver.currentLatitude !== undefined &&
      driver.currentLongitude !== null &&
      driver.currentLongitude !== undefined;

    if (!hasLocation || !ride?.pickup) {
      return null;
    }

    return this.round2(
      this.haversineKm(
        {
          latitude: Number(driver.currentLatitude),
          longitude: Number(driver.currentLongitude),
        },
        ride.pickup,
      ),
    );
  }

  private async driverEventPayload(ride: any) {
    const driver = ride.driver
      ? await this.driverModel.findById(ride.driver)
      : null;

    return {
      rideId: String(ride._id),
      status: ride.status,
      etaMinutes: ride.etaMinutes ?? null,
      driver: driver ? this.driverCard(driver) : null,
    };
  }

  private statusPayload(ride: any, driverId?: string) {
    return {
      rideId: String(ride._id),
      status: ride.status,
      etaMinutes: ride.etaMinutes ?? null,
      driverId: driverId || (ride.driver ? String(ride.driver) : null),
      nextAction: this.nextActionFor(ride),
    };
  }

  private emitRideEvent(ride: any, event: string, payload: any) {
    this.socketService.emitToRideAndActor(
      ride.user,
      String(ride._id),
      event,
      payload,
    );
  }

  // ==========================================================
  // Recurring booking helpers
  // ==========================================================
  private recurringRule(series: any) {
    return {
      daysOfWeek: series.daysOfWeek || [],
      pickupTime: series.pickupTime,
      startDate: series.startDate,
      endDate: series.endDate || null,
    };
  }

  private cleanDaysOfWeek(days: number[]) {
    const cleaned = (Array.isArray(days) ? days : [])
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

    return [...new Set(cleaned)].sort((a, b) => a - b);
  }

  private parsePickupTime(value: string) {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec((value || '').trim());

    if (!match) {
      return null;
    }

    return { hours: Number(match[1]), minutes: Number(match[2]) };
  }

  private startOfDay(value: Date) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(value: Date) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  // First pickup of a series that is still ahead of `from`, null when the
  // series has no pickup left to run.
  private nextOccurrenceFor(
    rule: {
      daysOfWeek: number[];
      pickupTime: string;
      startDate: Date;
      endDate?: Date | null;
    },
    from: Date,
  ) {
    const time = this.parsePickupTime(rule.pickupTime);

    if (!time) {
      return null;
    }

    const days = this.cleanDaysOfWeek(rule.daysOfWeek);

    if (!days.length) {
      return null;
    }

    const firstDay = this.startOfDay(rule.startDate);
    const lastDay = rule.endDate ? this.endOfDay(rule.endDate) : null;
    const cursor = this.startOfDay(
      new Date(Math.max(from.getTime(), firstDay.getTime())),
    );

    for (let offset = 0; offset <= RECURRING_LOOKAHEAD_DAYS; offset += 1) {
      const day = new Date(cursor);
      day.setDate(day.getDate() + offset);

      if (!days.includes(day.getDay())) {
        continue;
      }

      const occurrence = new Date(day);
      occurrence.setHours(time.hours, time.minutes, 0, 0);

      // The series is over, so no pickup is left.
      if (lastDay && occurrence.getTime() > lastDay.getTime()) {
        return null;
      }

      if (occurrence.getTime() > from.getTime()) {
        return occurrence;
      }
    }

    return null;
  }

  // Same lookup, but a pickup that already has its ride is skipped, so an edit
  // or a resume never books the same pickup twice.
  private async nextFreeOccurrence(series: any, from: Date) {
    const rule = this.recurringRule(series);
    let occurrence = this.nextOccurrenceFor(rule, from);
    let guard = 0;

    while (occurrence && guard < RECURRING_LOOKAHEAD_DAYS) {
      const rideExists = await this.rideModel.exists({
        recurringId: String(series._id),
        scheduledAt: occurrence,
      });

      if (!rideExists) {
        return occurrence;
      }

      occurrence = this.nextOccurrenceFor(rule, occurrence);
      guard += 1;
    }

    return occurrence;
  }

  private findRecurringRide(user: any, recurringId: string) {
    if (!Types.ObjectId.isValid(recurringId)) {
      return null;
    }

    return this.recurringModel.findOne({ _id: recurringId, user: user.id });
  }

  private recurringPayload(series: any) {
    return {
      recurringId: String(series._id),
      status: series.status,
      vehicleTypeId: series.vehicleTypeId,
      vehicleTypeName: series.vehicleTypeName || null,
      pickup: series.pickup,
      dropoff: series.dropoff,
      daysOfWeek: series.daysOfWeek || [],
      pickupTime: series.pickupTime,
      startDate: series.startDate || null,
      endDate: series.endDate || null,
      passengerCount: series.passengerCount,
      paymentMethod: series.paymentMethod,
      notes: series.notes || null,
      promoCode: series.promoCode || null,
      nextOccurrenceAt: series.nextOccurrenceAt || null,
      ridesCreated: series.ridesCreated || 0,
      lastRideAt: series.lastRideAt || null,
      cancelReason: series.cancelReason || null,
      cancelledAt: series.cancelledAt || null,
      createdAt: series.createdAt || null,
      updatedAt: series.updatedAt || null,
    };
  }

  // The ride of one pickup of a series. It waits exactly like a scheduled
  // ride, so the same dispatch notifies the drivers before the pickup.
  private async createRecurringRideFor(
    series: RecurringBookingDocument,
    occurrenceAt: Date,
  ) {
    try {
      const vehicleType = await this.vehicleTypeModel.findById(
        series.vehicleTypeId,
      );

      if (!vehicleType || vehicleType.status !== 'Active') {
        return null;
      }

      const route = await this.resolveDistance(series.pickup, series.dropoff);

      if (route.distanceKm === null) {
        console.error(
          'Recurring ride skipped, distance not resolved:',
          route.routeError,
        );
        return null;
      }

      const promoCheck = await this.resolvePromo(series.promoCode || undefined);
      const pricing = await this.pricingModel.findOne({}).lean();
      const fare = this.calculateFare(vehicleType, pricing, {
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes || 0,
        promo: promoCheck.promo,
      });

      const ride = await this.rideModel.create({
        user: series.user,
        companyId: series.companyId || null,
        vehicleTypeId: String((vehicleType as any)._id),
        vehicleTypeName: vehicleType.name,
        status: RideStatus.SCHEDULED,
        pickup: series.pickup,
        dropoff: series.dropoff,
        distanceKm: Number(route.distanceKm.toFixed(2)),
        durationMinutes: Math.round(route.durationMinutes || 0),
        etaMinutes: Math.round(route.durationMinutes || 0),
        routeSource: route.routeSource,
        fare,
        totalFare: fare.totalFare,
        payableFare: fare.payableFare,
        promoCode: promoCheck.promo ? promoCheck.promo.code : null,
        discount: fare.discount,
        rideType: RideType.RECURRING,
        scheduledAt: occurrenceAt,
        recurringId: String(series._id),
        passengerCount: series.passengerCount || 1,
        paymentMethod: series.paymentMethod || PaymentMethod.CASH,
        paymentStatus: PaymentStatus.PENDING,
        notes: series.notes || null,
        otp: generateOtp(),
      });

      if (promoCheck.promo) {
        await this.promoModel.updateOne(
          { _id: (promoCheck.promo as any)._id },
          { $inc: { usedCount: 1 } },
        );
      }

      // The passenger sees the ride of the next pickup right away, the drivers
      // are only told by the scheduled dispatch.
      const rideId = String(ride._id);

      this.socketService.joinActorToRide(series.user, rideId);
      this.socketService.emitToRideAndActor(
        series.user,
        rideId,
        RIDE_EVENTS.CREATED,
        this.rideSummary(ride, vehicleType),
      );

      return ride;
    } catch (error) {
      console.error('Error while creating the recurring ride:', error);
      return null;
    }
  }

  private round2(value: number) {
    return Number((value || 0).toFixed(2));
  }

  private daysAgo(days: number) {
    const date = new Date(Date.now() - Math.max(days - 1, 0) * DAY_IN_MS);
    date.setHours(0, 0, 0, 0);

    return date;
  }

  private dateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  // Day key (YYYY-MM-DD) of the running day, used by the dashboard cards which
  // follow the day of the driver and not the UTC day.
  private localDateKey(date: Date) {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    return `${date.getFullYear()}-${month}-${day}`;
  }
}
