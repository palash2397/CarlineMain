import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';

import { DriverStatus } from 'src/common/enums/driver/status-enum';
import { CancelledBy } from 'src/common/enums/ride/cancelled-by.enum';
import { PaymentMethod } from 'src/common/enums/ride/payment-method.enum';
import { PaymentStatus } from 'src/common/enums/ride/payment-status.enum';
import { RideStatus } from 'src/common/enums/ride/ride-status.enum';

import { Driver, DriverDocument } from '../driver/schema/driver.schema';
import { SocketService } from '../socket/socket.service';
import { User, UserDocument } from '../user/schema/user.schema';
import {
  VehicleType,
  VehicleTypeDocument,
} from '../vehicle-type/schema/vehicle-type.schema';

import { RideService } from './ride.service';
import { Ride, RideDocument } from './schema/ride.schema';

import {
  AVERAGE_SPEED_KMH,
  DEFAULT_CURRENCY,
  DRIVER_REQUEST_LIMIT,
  DRIVER_ROOM,
  DRIVER_RUNNING_STATUSES,
  DRIVER_SEARCH_RADIUS_KM,
  KM_PER_MILE,
  RIDE_EVENTS,
  driverRoomFor,
} from './ride.constants';

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

// Driver side of the booking flow: duty, ride requests, trip lifecycle and
// earnings. Used by the driver app (role DRIVER).
@Injectable()
export class DriverRideService {
  constructor(
    @InjectModel(Ride.name)
    private readonly rideModel: Model<RideDocument>,
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(VehicleType.name)
    private readonly vehicleTypeModel: Model<VehicleTypeDocument>,
    private readonly rideService: RideService,
    private readonly socketService: SocketService,
  ) {}
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

      if (dto.isOnline) {
        const vehicleType = await this.vehicleTypeForDriver(driver);

        if (!vehicleType) {
          return new ApiResponse(400, {}, Msg.DRIVER_VEHICLE_NOT_SET);
        }
      } else if (await this.findRunningRide(driverId)) {
        return new ApiResponse(400, {}, Msg.DRIVER_GO_OFFLINE_BLOCKED);
      }

      driver.isOnline = dto.isOnline;
      await driver.save();

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

      const result: any = await this.rideService.updateDriverLocation(
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

      // arrived pehle hona zaroori hai, tabhi trip start hoti hai.
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
  async cancelRide(driverId: string, dto: DriverCancelRideDto) {
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
  async activeRide(driverId: string) {
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

    if (!driver) {
      return [DRIVER_ROOM];
    }

    const vehicleType = await this.vehicleTypeForDriver(driver);

    return vehicleType
      ? [DRIVER_ROOM, driverRoomFor(String(vehicleType._id))]
      : [DRIVER_ROOM];
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

  async rideDetails(driverId: string, rideId: string) {
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

  // Status ke hisaab se next tap kya hona chahiye (frontend button enable/disable ke liye).
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

  // Action allowed nahi hai to status ke hisaab se saaf message.
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

  private toMiles(distanceKm: number) {
    return Number((distanceKm / KM_PER_MILE).toFixed(2));
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
}
