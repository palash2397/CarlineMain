import { RideService } from './ride.service';

const USER_ID = '6aad4206e4a94e8b156e180d';
const RIDE_ID = '6ab0ff14f754d1255ae3eab0';
const DRIVER_ID = '6aa8e3a259dc9fc0913ababe';

const SEDAN = {
  _id: '6ab0f9c00fc5ffbd2fbe62df',
  name: 'Sedan Comfort',
  seats: 4,
  badge: 'POPULAR',
  etaText: '3-5 min',
  basePrice: 18.3,
  perKmRate: 1.8,
  perMinuteRate: 0.4,
  image: 'https://example.com/sedan.png',
  description: 'Comfortable 4-seat everyday sedan',
  status: 'Active',
  sortOrder: 1,
};

const SUV = {
  _id: '6ab0f383f9ae9e0b487bb967',
  name: 'SUV 6-Seater',
  seats: 6,
  badge: null,
  etaText: '5-8 min',
  basePrice: 26.8,
  perKmRate: 2.4,
  perMinuteRate: 0.5,
  status: 'Active',
  sortOrder: 2,
};

const PICKUP = { address: 'Ferry Building', latitude: 37.7749, longitude: -122.4194 };
const DROPOFF = { address: 'SFO Terminal 2', latitude: 37.6213, longitude: -122.3790 };

const RIDE_DOC = () => ({
  _id: RIDE_ID,
  user: USER_ID,
  status: 'SEARCHING_DRIVER',
  vehicleTypeId: SEDAN._id,
  vehicleTypeName: SEDAN.name,
  pickup: PICKUP,
  dropoff: DROPOFF,
  distanceKm: 22.68,
  durationMinutes: 54,
  etaMinutes: 54,
  fare: { totalFare: 80.89, payableFare: 80.89 },
  totalFare: 80.89,
  payableFare: 80.89,
  passengerCount: 1,
  rideType: 'INSTANT',
  paymentMethod: 'CASH',
  paymentStatus: 'PENDING',
  otp: '123456',
  discount: 0,
  save: jest.fn().mockResolvedValue(true),
});

describe('RideService (user booking)', () => {
  let service: RideService;
  let rideModel: any;
  let promoModel: any;
  let vehicleTypeModel: any;
  let driverModel: any;
  let pricingModel: any;
  let socketService: any;

  beforeEach(() => {
    rideModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
    };
    promoModel = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn(),
      updateOne: jest.fn(),
    };
    vehicleTypeModel = {
      find: jest.fn(),
      findById: jest.fn().mockResolvedValue(SEDAN),
    };
    driverModel = {
      find: jest.fn(),
      findById: jest.fn(),
      updateOne: jest.fn(),
    };
    pricingModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          fareRules: { baseFare: 4.5, minimumFare: 7.5, perKmRate: 1.8, perMinuteRate: 0.4 },
        }),
      }),
    };
    socketService = {
      emitToUser: jest.fn(),
      emitToRide: jest.fn(),
      emitToRideAndActor: jest.fn(),
      joinActorToRide: jest.fn(),
      emitToDrivers: jest.fn(),
      getServer: jest.fn().mockReturnValue(null),
    };

    service = new RideService(
      rideModel,
      promoModel,
      vehicleTypeModel,
      driverModel,
      pricingModel,
      socketService,
    );
  });

  describe('vehicle types', () => {
    it('returns the active vehicle list for the booking screen', async () => {
      vehicleTypeModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue([SEDAN, SUV]),
        }),
      });

      const res: any = await service.listVehicleTypes();

      expect(res.statusCode).toBe(200);
      expect(res.data).toHaveLength(2);
      expect(vehicleTypeModel.find).toHaveBeenCalledWith({ status: 'Active' });
    });
  });

  describe('estimateFare', () => {
    beforeEach(() => {
      vehicleTypeModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([SEDAN, SUV]),
      });
    });

    it('calculates distance, ETA and the fare of every vehicle type', async () => {
      const res: any = await service.estimateFare({ id: USER_ID }, {
        pickup: PICKUP,
        dropoff: DROPOFF,
      });

      expect(res.statusCode).toBe(200);
      expect(res.data.distanceKm).toBeCloseTo(22.68, 1);
      expect(res.data.distanceMiles).toBeCloseTo(14.09, 1);
      expect(res.data.durationMinutes).toBeCloseTo(54, 0);
      expect(res.data.options).toHaveLength(2);

      const sedanFare = res.data.options[0].fare;
      expect(sedanFare.basePrice).toBe(18.3);
      expect(sedanFare.distanceRate).toBeCloseTo(40.82, 1);
      expect(sedanFare.timeRate).toBeCloseTo(21.77, 1);
      expect(sedanFare.totalFare).toBeCloseTo(80.89, 1);
      expect(res.data.options[1].fare.totalFare).toBeGreaterThan(sedanFare.totalFare);
    });

    it('asks for a valid route when coordinates are missing', async () => {
      const res: any = await service.estimateFare({ id: USER_ID }, {
        pickup: { address: 'somewhere' } as any,
        dropoff: { address: 'elsewhere' } as any,
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('bookRide', () => {
    const bookDto = (extra: any = {}) => ({
      pickup: PICKUP,
      dropoff: DROPOFF,
      vehicleTypeId: SEDAN._id,
      passengerCount: 2,
      ...extra,
    });

    it('creates an instant booking with the server side fare and emits it', async () => {
      rideModel.create.mockImplementation(async (payload: any) => ({
        ...RIDE_DOC(),
        ...payload,
      }));

      const res: any = await service.bookRide({ id: USER_ID }, bookDto());

      expect(res.statusCode).toBe(200);
      expect(res.message).toBe('Ride booked successfully');
      expect(res.data.status).toBe('SEARCHING_DRIVER');
      expect(res.data.otp).toBeDefined();
      expect(res.data.payableFare).toBeCloseTo(res.data.fare.totalFare, 2);
      expect(res.data.vehicleType.name).toBe('Sedan Comfort');
      expect(socketService.joinActorToRide).toHaveBeenCalledWith(
        USER_ID,
        RIDE_ID,
      );
      expect(socketService.emitToRideAndActor).toHaveBeenCalledWith(
        USER_ID,
        RIDE_ID,
        'ride:created',
        expect.objectContaining({ rideId: RIDE_ID }),
      );
      expect(socketService.emitToDrivers).toHaveBeenCalledWith(
        'ride:request',
        expect.objectContaining({ rideId: RIDE_ID }),
        SEDAN._id,
      );
    });

    it('counts the promo usage after booking with a promo code', async () => {
      promoModel.findOne.mockResolvedValue({
        _id: 'promo1',
        code: 'CARLINE10',
        type: 'PERCENT',
        value: 10,
        maxDiscount: 20,
        isActive: true,
      });
      rideModel.create.mockImplementation(async (payload: any) => ({
        ...RIDE_DOC(),
        ...payload,
      }));

      const res: any = await service.bookRide({ id: USER_ID }, bookDto({ promoCode: 'CARLINE10' }));

      expect(res.data.discount).toBeGreaterThan(0);
      expect(promoModel.updateOne).toHaveBeenCalledWith(
        { _id: 'promo1' },
        { $inc: { usedCount: 1 } },
      );
    });

    it('denies an unknown vehicle type', async () => {
      vehicleTypeModel.findById.mockResolvedValue(null);

      const res: any = await service.bookRide({ id: USER_ID }, bookDto());

      expect(res.statusCode).toBe(404);
      expect(rideModel.create).not.toHaveBeenCalled();
    });

    it('denies a scheduled ride without a pickup time', async () => {
      const res: any = await service.bookRide(
        { id: USER_ID },
        bookDto({ rideType: 'SCHEDULED' }),
      );

      expect(res.statusCode).toBe(400);
      expect(res.message).toContain('required');
    });

    it('denies a scheduled ride in the past', async () => {
      const res: any = await service.bookRide(
        { id: USER_ID },
        bookDto({ rideType: 'SCHEDULED', scheduledAt: new Date(Date.now() - 60000) }),
      );

      expect(res.statusCode).toBe(400);
      expect(res.message).toContain('future');
    });

    it('accepts a future scheduled ride', async () => {
      rideModel.create.mockImplementation(async (payload: any) => ({
        ...RIDE_DOC(),
        ...payload,
      }));

      const res: any = await service.bookRide(
        { id: USER_ID },
        bookDto({ rideType: 'SCHEDULED', scheduledAt: new Date(Date.now() + 3600000) }),
      );

      expect(res.statusCode).toBe(200);
      expect(res.data.rideType).toBe('SCHEDULED');
      expect(res.data.scheduledAt).toBeTruthy();
    });

    it('denies an unknown promo code', async () => {
      const res: any = await service.bookRide(
        { id: USER_ID },
        bookDto({ promoCode: 'NOPE' }),
      );

      expect(res.statusCode).toBe(400);
      expect(rideModel.create).not.toHaveBeenCalled();

    });

    it('caps a percentage discount with maxDiscount', async () => {
      promoModel.findOne.mockResolvedValue({
        code: 'BIG',
        type: 'PERCENT',
        value: 50,
        maxDiscount: 10,
        isActive: true,
      });
      rideModel.create.mockImplementation(async (payload: any) => ({
        ...RIDE_DOC(),
        ...payload,
      }));

      const res: any = await service.bookRide(
        { id: USER_ID },
        bookDto({ promoCode: 'BIG' }),
      );

      expect(res.statusCode).toBe(200);
      expect(res.data.discount).toBe(10);
    });

    it('denies an expired promo code', async () => {
      promoModel.findOne.mockResolvedValue({
        code: 'OLD',
        type: 'FLAT',
        value: 5,
        isActive: true,
        expiresAt: new Date(Date.now() - 1000),
      });

      const res: any = await service.bookRide(
        { id: USER_ID },
        bookDto({ promoCode: 'OLD' }),
      );

      expect(res.statusCode).toBe(400);
      expect(res.message).toContain('expired');
    });

    it('denies a promo code whose usage limit is over', async () => {
      promoModel.findOne.mockResolvedValue({
        code: 'OVER',
        type: 'FLAT',
        value: 5,
        isActive: true,
        usageLimit: 10,
        usedCount: 10,
      });

      const res: any = await service.bookRide(
        { id: USER_ID },
        bookDto({ promoCode: 'OVER' }),
      );

      expect(res.statusCode).toBe(400);
      expect(res.message).toContain('limit');
    });
  });

  describe('myRides', () => {
    it('returns the passenger ride activity with pagination', async () => {
      const chain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([RIDE_DOC()]),
      };
      rideModel.find.mockReturnValue(chain);
      rideModel.countDocuments.mockResolvedValue(1);

      const res: any = await service.myRides({ id: USER_ID }, { page: 1, limit: 10 });

      expect(res.statusCode).toBe(200);
      expect(res.data.total).toBe(1);
      expect(res.data.items[0].rideId).toBe(RIDE_ID);
      expect(rideModel.find).toHaveBeenCalledWith({ user: USER_ID });
    });

    it('filters the activity by status', async () => {
      const chain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      rideModel.find.mockReturnValue(chain);
      rideModel.countDocuments.mockResolvedValue(0);

      await service.myRides({ id: USER_ID }, { status: 'RIDE_COMPLETED' });

      expect(rideModel.find).toHaveBeenCalledWith({
        user: USER_ID,
        status: 'RIDE_COMPLETED',
      });
    });
  });

  describe('cancelRide', () => {
    it('cancels a searching ride and notifies the ride room', async () => {
      const ride: any = RIDE_DOC();
      rideModel.findOne.mockResolvedValue(ride);

      const res: any = await service.cancelRide(
        { id: USER_ID },
        { rideId: RIDE_ID, reason: 'Plans changed' },
      );

      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe('RIDE_CANCELLED');
      expect(res.data.cancelledBy).toBe('USER');
      expect(ride.cancelReason).toBe('Plans changed');
      expect(ride.save).toHaveBeenCalled();
      expect(socketService.emitToRide).toHaveBeenCalledWith(
        RIDE_ID,
        'ride:cancelled',
        expect.objectContaining({ rideId: RIDE_ID }),
      );
    });

    it('denies cancelling a completed ride', async () => {
      rideModel.findOne.mockResolvedValue({
        ...RIDE_DOC(),
        status: 'RIDE_COMPLETED',
      });

      const res: any = await service.cancelRide({ id: USER_ID }, { rideId: RIDE_ID });

      expect(res.statusCode).toBe(400);
      expect(res.message).toContain('cancelled');
    });

    it('denies cancelling an unknown ride', async () => {
      rideModel.findOne.mockResolvedValue(null);

      const res: any = await service.cancelRide({ id: USER_ID }, { rideId: RIDE_ID });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('nearbyCabs', () => {
    it('counts only the online drivers inside the search radius', async () => {
      driverModel.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { _id: 'd1', fullName: 'Near', vehicleType: 'Sedan', currentLatitude: 37.78, currentLongitude: -122.42 },
          { _id: 'd2', fullName: 'Far', vehicleType: 'SUV', currentLatitude: 38.9, currentLongitude: -123.9 },
        ]),
      });

      const res: any = await service.nearbyCabs({ id: USER_ID }, {
        lat: 37.7749,
        lng: -122.4194,
      });

      expect(res.statusCode).toBe(200);
      expect(res.data.count).toBe(1);
      expect(res.data.drivers[0].driverId).toBe('d1');
      expect(res.data.radiusKm).toBe(5);
    });
  });

  describe('updateDriverLocation', () => {
    it('stores the driver location and shares the ETA with the ride room', async () => {
      const ride: any = RIDE_DOC();
      ride.driver = DRIVER_ID;
      rideModel.findOne.mockResolvedValue(ride);

      const res: any = await service.updateDriverLocation(DRIVER_ID, {
        latitude: 37.75,
        longitude: -122.45,
        rideId: RIDE_ID,
      });

      expect(driverModel.updateOne).toHaveBeenCalled();
      expect(res.success).toBe(true);
      expect(res.etaMinutes).toBeGreaterThan(0);
      expect(ride.etaMinutes).toBe(res.etaMinutes);
      expect(socketService.emitToRide).toHaveBeenCalledWith(
        RIDE_ID,
        'ride:driverLocation',
        expect.objectContaining({ etaMinutes: res.etaMinutes }),
      );
    });

    it('only stores the location when no ride is given', async () => {
      const res: any = await service.updateDriverLocation(DRIVER_ID, {
        latitude: 37.75,
        longitude: -122.45,
      });

      expect(res.success).toBe(true);
      expect(rideModel.findOne).not.toHaveBeenCalled();
    });
  });

});
