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
import { RideStatus } from 'src/common/enums/ride/ride-status.enum';
import { RideType } from 'src/common/enums/ride/ride-type.enum';

import { Driver, DriverDocument } from '../driver/schema/driver.schema';
import { Pricing, PricingDocument } from '../pricing/schema/pricing.schema';
import { SocketService } from '../socket/socket.service';
import {
  VehicleType,
  VehicleTypeDocument,
} from '../vehicle-type/schema/vehicle-type.schema';

import { Promo, PromoDocument } from './schema/promo.schema';
import {
  Ride,
  RideDocument,
  RideFareBreakdown,
  RideLocation,
} from './schema/ride.schema';

import {
  AVERAGE_SPEED_KMH,
  DEFAULT_CURRENCY,
  DRIVER_SEARCH_RADIUS_KM,
  KM_PER_MILE,
  RIDE_EVENTS,
  ROAD_DISTANCE_FACTOR,
} from 'src/constants';

import { BookRideDto } from './dto/book-ride.dto';
import { CancelRideDto } from './dto/cancel-ride.dto';
import { DriverLocationDto } from './dto/driver-location.dto';
import { EstimateFareDto } from './dto/estimate-fare.dto';
import { MyRidesQueryDto } from './dto/my-rides-query.dto';
import { NearbyCabsDto } from './dto/nearby-cabs.dto';

const CANCELLABLE_STATUSES = [
  RideStatus.SEARCHING_DRIVER,
  RideStatus.DRIVER_ASSIGNED,
  RideStatus.DRIVER_ARRIVED,
];

@Injectable()
export class RideService {
  constructor(
    @InjectModel(Ride.name)
    private readonly rideModel: Model<RideDocument>,
    @InjectModel(Promo.name)
    private readonly promoModel: Model<PromoDocument>,
    @InjectModel(VehicleType.name)
    private readonly vehicleTypeModel: Model<VehicleTypeDocument>,
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
    @InjectModel(Pricing.name)
    private readonly pricingModel: Model<PricingDocument>,
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
        return new ApiResponse(400, {}, Msg.ROUTE_NOT_FOUND);
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
      if (!Types.ObjectId.isValid(dto.vehicleTypeId)) {
        return new ApiResponse(404, {}, Msg.VEHICLE_TYPE_NOT_FOUND);
      }

      const vehicleType = await this.vehicleTypeModel.findById(dto.vehicleTypeId);

      if (!vehicleType || vehicleType.status !== 'Active') {
        return new ApiResponse(404, {}, Msg.VEHICLE_TYPE_NOT_FOUND);
      }

      const rideType = dto.rideType || RideType.INSTANT;
      let scheduledAt: Date | null = null;

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
        return new ApiResponse(400, {}, Msg.ROUTE_NOT_FOUND);
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
        status: RideStatus.SEARCHING_DRIVER,
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
      this.notifyDrivers(summary);

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
      const ride = await this.rideModel
        .findOne({ user: user.id, status: { $in: CANCELLABLE_STATUSES } })
        .sort({ createdAt: -1 });

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
      const ride = await this.rideModel
        .findOne({
          user: userId,
          status: { $in: CANCELLABLE_STATUSES },
        })
        .sort({ createdAt: -1 })
        .select('_id');

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

  private async googleDistance(pickup: any, dropoff: any) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey || !pickup || !dropoff) {
      return null;
    }

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
      };
    }

    const matrix = await this.googleDistance(pickup, dropoff);

    const distanceKm = matrix
      ? Number(matrix.distanceKm.toFixed(2))
      : Number((this.haversineKm(pickup, dropoff) * ROAD_DISTANCE_FACTOR).toFixed(2));

    const durationMinutes = matrix
      ? Number(matrix.durationMinutes.toFixed(2))
      : Number(((distanceKm / AVERAGE_SPEED_KMH) * 60).toFixed(2));

    return {
      distanceKm,
      durationMinutes,
      routeSource: matrix ? 'GOOGLE_MAPS' : 'BACKEND_ESTIMATE',
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
}
