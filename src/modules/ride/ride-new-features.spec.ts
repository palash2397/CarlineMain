import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { RideService } from './ride.service';
import { Ride } from './schema/ride.schema';
import { Promo } from './schema/promo.schema';
import { RecurringBooking } from './schema/recurring-booking.schema';
import { VehicleType } from '../vehicle-type/schema/vehicle-type.schema';
import { Driver } from '../driver/schema/driver.schema';
import { Pricing } from '../pricing/schema/pricing.schema';
import { User } from '../user/schema/user.schema';
import { SocketService } from '../socket/socket.service';

import { RideStatus } from '../../common/enums/ride/ride-status.enum';
import { RideType } from '../../common/enums/ride/ride-type.enum';
import { PaymentMethod } from '../../common/enums/ride/payment-method.enum';
import { UserRole } from '../../common/enums/user/role.enum';
import { Msg } from '../../helpers/responseMsg';

describe('RideService New Features (Recurring Delete, Dispatcher Booking, Modify Ride)', () => {
  let service: RideService;
  let mockRideModel: any;
  let mockRecurringModel: any;
  let mockVehicleTypeModel: any;
  let mockDriverModel: any;
  let mockPricingModel: any;
  let mockUserModel: any;
  let mockPromoModel: any;
  let mockSocketService: any;

  beforeEach(async () => {
    mockRideModel = {
      create: jest.fn(),
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
      findById: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn(),
    };

    mockRecurringModel = {
      findOne: jest.fn(),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    };

    mockVehicleTypeModel = {
      findById: jest.fn(),
      findOne: jest.fn().mockResolvedValue({
        _id: '6ab0f9c00fc5ffbd2fbe62df',
        name: 'Sedan',
        status: 'Active',
      }),
    };

    mockDriverModel = {
      findById: jest.fn(),
    };

    mockPricingModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          baseFare: 50,
          perKmRate: 10,
          perMinuteRate: 2,
          taxRatePercentage: 5,
        }),
      }),
    };

    mockUserModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    };

    mockPromoModel = {
      findOne: jest.fn(),
      updateOne: jest.fn(),
    };

    mockSocketService = {
      joinActorToRide: jest.fn(),
      emitToRideAndActor: jest.fn(),
      emitToRide: jest.fn(),
      emitToDriver: jest.fn(),
      emitToDrivers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RideService,
        { provide: getModelToken(Ride.name), useValue: mockRideModel },
        { provide: getModelToken(Promo.name), useValue: mockPromoModel },
        {
          provide: getModelToken(RecurringBooking.name),
          useValue: mockRecurringModel,
        },
        {
          provide: getModelToken(VehicleType.name),
          useValue: mockVehicleTypeModel,
        },
        { provide: getModelToken(Driver.name), useValue: mockDriverModel },
        { provide: getModelToken(Pricing.name), useValue: mockPricingModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: SocketService, useValue: mockSocketService },
      ],
    }).compile();

    service = module.get<RideService>(RideService);

    jest.spyOn(service as any, 'googleDistance').mockResolvedValue({
      distanceKm: 10,
      durationMinutes: 15,
      routeSource: 'GOOGLE',
    });
  });

  describe('deleteRecurringRide', () => {
    it('should return 404 if recurring booking does not exist', async () => {
      mockRecurringModel.findOne.mockResolvedValue(null);

      const result = await service.deleteRecurringRide(
        { id: new Types.ObjectId().toString() },
        new Types.ObjectId().toString(),
      );

      expect(result.statusCode).toBe(404);
      expect(result.message).toBe(Msg.RECURRING_RIDE_NOT_FOUND);
    });

    it('should delete recurring booking series and cancel pending rides', async () => {
      const recurringId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();

      mockRecurringModel.findOne.mockResolvedValue({
        _id: recurringId,
        user: userId,
      });

      const mockPendingRide = {
        _id: new Types.ObjectId().toString(),
        status: RideStatus.SCHEDULED,
        save: jest.fn().mockResolvedValue(true),
      };

      mockRideModel.find.mockResolvedValue([mockPendingRide]);

      const result = await service.deleteRecurringRide(
        { id: userId },
        recurringId,
      );

      expect(result.statusCode).toBe(200);
      expect(result.message).toBe(Msg.RECURRING_RIDE_DELETED);
      expect(mockPendingRide.status).toBe(RideStatus.RIDE_CANCELLED);
      expect(mockPendingRide.save).toHaveBeenCalled();
      expect(mockRecurringModel.deleteOne).toHaveBeenCalledWith({
        _id: recurringId,
      });
    });
  });

  describe('bookDispatcherRide', () => {
    it('should return 404 if vehicle type is not found', async () => {
      mockVehicleTypeModel.findById.mockResolvedValue(null);
      mockVehicleTypeModel.findOne.mockResolvedValue(null);

      const result = await service.bookDispatcherRide(
        { id: new Types.ObjectId().toString(), role: UserRole.DISPATCHER },
        {
          pickup: { latitude: 37.7749, longitude: -122.4194 },
          dropoff: { latitude: 37.7849, longitude: -122.4094 },
          vehicleTypeId: 'nonexistent',
        } as any,
      );

      expect(result.statusCode).toBe(404);
    });

    it('should successfully create a dispatcher booking for a passenger', async () => {
      const dispatcherId = new Types.ObjectId().toString();
      const passengerId = new Types.ObjectId().toString();
      const vehicleTypeId = new Types.ObjectId().toString();

      mockUserModel.findById.mockResolvedValue({
        _id: passengerId,
        firstName: 'Test',
        lastName: 'Passenger',
      });

      mockVehicleTypeModel.findById.mockResolvedValue({
        _id: vehicleTypeId,
        name: 'Sedan',
        status: 'Active',
        basePrice: 50,
        perKmPrice: 10,
        perMinutePrice: 2,
      });

      const mockCreatedRide = {
        _id: new Types.ObjectId().toString(),
        user: passengerId,
        vehicleTypeId,
        vehicleTypeName: 'Sedan',
        status: RideStatus.SEARCHING_DRIVER,
        pickup: { latitude: 37.7749, longitude: -122.4194 },
        dropoff: { latitude: 37.7849, longitude: -122.4094 },
        fare: { totalFare: 100, payableFare: 100 },
        totalFare: 100,
        payableFare: 100,
        rideType: RideType.INSTANT,
        passengerCount: 1,
        paymentMethod: PaymentMethod.CASH,
      };

      mockRideModel.create.mockResolvedValue(mockCreatedRide);

      const result = await service.bookDispatcherRide(
        { id: dispatcherId, role: UserRole.DISPATCHER },
        {
          userId: passengerId,
          pickup: { latitude: 37.7749, longitude: -122.4194 },
          dropoff: { latitude: 37.7849, longitude: -122.4094 },
          vehicleTypeId,
          paymentMethod: PaymentMethod.CASH,
        } as any,
      );

      expect(result.statusCode).toBe(200);
      expect(result.message).toBe(Msg.DISPATCHER_RIDE_BOOKED);
      expect(mockRideModel.create).toHaveBeenCalled();
    });
  });

  describe('modifyRide', () => {
    it('should return 400 if ride status cannot be modified (e.g. RIDE_STARTED)', async () => {
      const rideId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();

      mockRideModel.findById.mockResolvedValue({
        _id: rideId,
        user: userId,
        status: RideStatus.RIDE_STARTED,
      });

      const result = await service.modifyRide(
        { id: userId, role: UserRole.USER },
        rideId,
        { passengerCount: 2 },
      );

      expect(result.statusCode).toBe(400);
      expect(result.message).toBe(Msg.RIDE_CANNOT_MODIFY);
    });

    it('should modify an active ride in SEARCHING_DRIVER status successfully', async () => {
      const rideId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();
      const vehicleTypeId = new Types.ObjectId().toString();

      const mockRide = {
        _id: rideId,
        user: userId,
        status: RideStatus.SEARCHING_DRIVER,
        vehicleTypeId,
        passengerCount: 1,
        save: jest.fn().mockResolvedValue(true),
      };

      mockRideModel.findById.mockResolvedValue(mockRide);
      mockVehicleTypeModel.findById.mockResolvedValue({
        _id: vehicleTypeId,
        name: 'Sedan',
        status: 'Active',
      });

      const result = await service.modifyRide(
        { id: userId, role: UserRole.USER },
        rideId,
        { passengerCount: 3, notes: 'Updated note' },
      );

      expect(result.statusCode).toBe(200);
      expect(result.message).toBe(Msg.RIDE_MODIFIED);
      expect(mockRide.passengerCount).toBe(3);
      expect(mockRide.save).toHaveBeenCalled();
    });
  });
});
