import { DriverRideService } from './driver-ride.service';

const DRIVER_ID = '6aa8e3a259dc9fc0913ababe';
const USER_ID = '6aad4206e4a94e8b156e180d';
const RIDE_ID = '6ab0ff14f754d1255ae3eab0';

const SEDAN = {
  _id: '6ab0f9c00fc5ffbd2fbe62df',
  name: 'Sedan Comfort',
  seats: 4,
  badge: 'POPULAR',
  etaText: '3-5 min',
  basePrice: 18.3,
  perKmRate: 1.8,
  perMinuteRate: 0.4,
  status: 'Active',
};

const DRIVER_DOC = () => ({
  _id: DRIVER_ID,
  fullName: 'Alex Johnson',
  phoneNumber: '+14155550123',
  email: 'alex@example.com',
  avatar: null,
  rating: 4.8,
  status: 'ACTIVE',
  isOnline: true,
  isVerified: true,
  vehicleTypeId: SEDAN._id,
  vehicleType: SEDAN.name,
  vehicleRegistrationNumber: 'CA-1234',
  companyId: null,
  currentLatitude: 37.7751,
  currentLongitude: -122.4194,
  lastLocationAt: new Date(),
  save: jest.fn().mockResolvedValue(true),
});

const RIDE_DOC = (overrides: any = {}) => ({
  _id: RIDE_ID,
  user: USER_ID,
  driver: null,
  status: 'SEARCHING_DRIVER',
  vehicleTypeId: SEDAN._id,
  vehicleTypeName: SEDAN.name,
  pickup: { address: 'Ferry Building', latitude: 37.7749, longitude: -122.4194 },
  dropoff: { address: 'SFO Terminal 2', latitude: 37.6213, longitude: -122.379 },
  distanceKm: 12.3,
  distanceMiles: 7.64,
  durationMinutes: 18,
  etaMinutes: 18,
  fare: { totalFare: 18, payableFare: 18 },
  totalFare: 18,
  payableFare: 18,
  passengerCount: 1,
  rideType: 'INSTANT',
  paymentMethod: 'CASH',
  paymentStatus: 'PENDING',
  otp: '4821',
  discount: 0,
  createdAt: new Date(),
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

describe('DriverRideService (driver booking)', () => {
  let service: DriverRideService;
  let rideModel: any;
  let driverModel: any;
  let userModel: any;
  let vehicleTypeModel: any;
  let rideService: any;
  let socketService: any;

  beforeEach(() => {
    rideModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
    };
    driverModel = {
      findById: jest.fn().mockResolvedValue(DRIVER_DOC()),
      findOne: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    userModel = {
      findById: jest.fn().mockResolvedValue({
        _id: USER_ID,
        firstName: 'Darlene',
        lastName: 'Robbins',
        phoneNumber: '+14155550999',
        email: 'darlene@example.com',
        avatar: null,
      }),
      find: jest.fn().mockResolvedValue([]),
    };
    vehicleTypeModel = {
      findById: jest.fn().mockResolvedValue(SEDAN),
      findOne: jest.fn().mockResolvedValue(SEDAN),
    };
    rideService = {
      updateDriverLocation: jest.fn().mockResolvedValue({
        success: true,
        latitude: 37.7751,
        longitude: -122.4194,
      }),
    };
    socketService = {
      emitToUser: jest.fn(),
      emitToRide: jest.fn(),
      emitToRideAndActor: jest.fn(),
      emitToDrivers: jest.fn(),
      joinActorToRide: jest.fn(),
      leaveRideRoom: jest.fn(),
    };

    service = new DriverRideService(
      rideModel,
      driverModel,
      userModel,
      vehicleTypeModel,
      rideService,
      socketService,
    );
  });

  describe('home', () => {
    it('returns the driver profile, duty, stats and running ride', async () => {
      rideModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });
      rideModel.countDocuments
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1);
      rideModel.aggregate.mockResolvedValue([
        { _id: null, totalEarned: 120.5, trips: 3 },
      ]);

      const res: any = await service.home(DRIVER_ID);

      expect(res.statusCode).toBe(200);
      expect(res.data.driver.driverId).toBe(DRIVER_ID);
      expect(res.data.duty.isOnline).toBe(true);
      expect(res.data.vehicleType.name).toBe(SEDAN.name);
      expect(res.data.stats.totalTrips).toBe(3);
      expect(res.data.stats.totalEarned).toBe(120.5);
      expect(res.data.activeRide).toBeNull();
    });

    it('denies an unknown driver', async () => {
      driverModel.findById.mockResolvedValue(null);

      const res: any = await service.home(DRIVER_ID);

      expect(res.statusCode).toBe(404);
    });
  });
  describe('setDuty', () => {
    it('turns the driver online when a vehicle type is set', async () => {
      const driver = DRIVER_DOC();
      driver.isOnline = false;
      driverModel.findById.mockResolvedValue(driver);
      rideModel.countDocuments.mockResolvedValue(0);
      rideModel.aggregate.mockResolvedValue([]);

      const res: any = await service.setDuty(DRIVER_ID, { isOnline: true });

      expect(res.statusCode).toBe(200);
      expect(driver.isOnline).toBe(true);
      expect(driver.save).toHaveBeenCalled();
      expect(res.data.duty.isOnline).toBe(true);
    });

    it('blocks going online without a vehicle type', async () => {
      const driver = DRIVER_DOC();
      driver.vehicleTypeId = null;
      driver.vehicleType = null;
      driverModel.findById.mockResolvedValue(driver);
      vehicleTypeModel.findById.mockResolvedValue(null);
      vehicleTypeModel.findOne.mockResolvedValue(null);

      const res: any = await service.setDuty(DRIVER_ID, { isOnline: true });

      expect(res.statusCode).toBe(400);
      expect(res.message).toContain('vehicle type');
    });

    it('blocks going offline with a running ride', async () => {
      rideModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(RIDE_DOC({ status: 'DRIVER_ASSIGNED' })),
      });

      const res: any = await service.setDuty(DRIVER_ID, { isOnline: false });

      expect(res.statusCode).toBe(400);
      expect(res.message).toContain('running ride');
    });
  });

  describe('requests', () => {
    it('returns the matching request with the distance to pickup', async () => {
      rideModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });
      rideModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([RIDE_DOC()]),
        }),
      });
      userModel.find.mockResolvedValue([
        { _id: USER_ID, firstName: 'Darlene', lastName: 'Robbins' },
      ]);

      const res: any = await service.requests(DRIVER_ID);

      expect(res.statusCode).toBe(200);
      expect(res.data.count).toBe(1);
      expect(res.data.requests[0].passenger.fullName).toBe('Darlene Robbins');
      expect(res.data.requests[0].distanceToPickupKm).toBeLessThan(1);
      expect(res.data.requests[0].pickupDistanceText).toContain('min away');
      expect(res.data.requests[0].dropDistanceText).toBe('12.3 km away');
    });

    it('denies requests while the driver is offline', async () => {
      const driver = DRIVER_DOC();
      driver.isOnline = false;
      driverModel.findById.mockResolvedValue(driver);

      const res: any = await service.requests(DRIVER_ID);

      expect(res.statusCode).toBe(400);
      expect(res.message).toContain('not online');
    });
  });

  describe('accept', () => {
    it('assigns the ride to the driver and notifies both apps', async () => {
      rideModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });
      rideModel.findById.mockResolvedValue(RIDE_DOC());
      rideModel.findOneAndUpdate.mockResolvedValue(
        RIDE_DOC({ driver: DRIVER_ID, status: 'DRIVER_ASSIGNED' }),
      );

      const res: any = await service.accept(DRIVER_ID, { rideId: RIDE_ID });

      expect(res.statusCode).toBe(200);
      expect(res.data.status).toBe('DRIVER_ASSIGNED');
      expect(socketService.joinActorToRide).toHaveBeenCalledWith(
        DRIVER_ID,
        RIDE_ID,
      );
      expect(socketService.emitToRideAndActor).toHaveBeenCalledWith(
        USER_ID,
        RIDE_ID,
        'ride:driver',
        expect.objectContaining({ rideId: RIDE_ID }),
      );
      expect(socketService.emitToRideAndActor).toHaveBeenCalledWith(
        USER_ID,
        RIDE_ID,
        'ride:status',
        expect.objectContaining({ status: 'DRIVER_ASSIGNED' }),
      );
      expect(socketService.emitToDrivers).toHaveBeenCalledWith(
        'ride:taken',
        expect.objectContaining({ rideId: RIDE_ID }),
        SEDAN._id,
      );
      expect(driverModel.updateOne).toHaveBeenCalled();
    });

    it('denies a ride of another vehicle type', async () => {
      rideModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });
      rideModel.findById.mockResolvedValue(
        RIDE_DOC({ vehicleTypeId: '6ab0f383f9ae9e0b487bb967' }),
      );

      const res: any = await service.accept(DRIVER_ID, { rideId: RIDE_ID });

      expect(res.statusCode).toBe(400);
      expect(res.message).toContain('vehicle type');
      expect(rideModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('denies a ride that another driver already took', async () => {
      rideModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });
      rideModel.findById.mockResolvedValue(
        RIDE_DOC({ status: 'DRIVER_ASSIGNED', driver: 'other-driver' }),
      );

      const res: any = await service.accept(DRIVER_ID, { rideId: RIDE_ID });

      expect(res.statusCode).toBe(400);
      expect(res.message).toContain('already accepted');
    });
  });

  describe('trip lifecycle', () => {
    it('marks the ride as arrived', async () => {
      const ride: any = RIDE_DOC({ driver: DRIVER_ID, status: 'DRIVER_ASSIGNED' });
      rideModel.findOne.mockResolvedValue(ride);

      const res: any = await service.arrived(DRIVER_ID, { rideId: RIDE_ID });

      expect(res.statusCode).toBe(200);
      expect(ride.status).toBe('DRIVER_ARRIVED');
      expect(socketService.emitToRideAndActor).toHaveBeenCalledWith(
        USER_ID,
        RIDE_ID,
        'ride:status',
        expect.objectContaining({ status: 'DRIVER_ARRIVED' }),
      );
    });

    it('starts the ride when the passenger OTP matches', async () => {
      const ride: any = RIDE_DOC({ driver: DRIVER_ID, status: 'DRIVER_ARRIVED' });
      rideModel.findOne.mockResolvedValue(ride);

      const res: any = await service.start(DRIVER_ID, {
        rideId: RIDE_ID,
        otp: '4821',
      });

      expect(res.statusCode).toBe(200);
      expect(ride.status).toBe('RIDE_STARTED');
      expect(ride.startedAt).toBeTruthy();
    });

    it('denies a wrong pickup OTP', async () => {
      const ride: any = RIDE_DOC({ driver: DRIVER_ID, status: 'DRIVER_ARRIVED' });
      rideModel.findOne.mockResolvedValue(ride);

      const res: any = await service.start(DRIVER_ID, {
        rideId: RIDE_ID,
        otp: '0000',
      });

      expect(res.statusCode).toBe(400);
      expect(res.message).toContain('OTP');
      expect(ride.status).toBe('DRIVER_ARRIVED');
    });

    it('completes a started ride and frees the driver', async () => {
      const ride: any = RIDE_DOC({ driver: DRIVER_ID, status: 'RIDE_STARTED' });
      rideModel.findOne.mockResolvedValue(ride);

      const res: any = await service.complete(DRIVER_ID, { rideId: RIDE_ID });

      expect(res.statusCode).toBe(200);
      expect(ride.status).toBe('RIDE_COMPLETED');
      expect(ride.paymentStatus).toBe('PENDING');
      expect(socketService.emitToRideAndActor).toHaveBeenCalledWith(
        USER_ID,
        RIDE_ID,
        'ride:completed',
        expect.objectContaining({ status: 'RIDE_COMPLETED' }),
      );
      expect(socketService.leaveRideRoom).toHaveBeenCalledWith(RIDE_ID);
    });

    it('auto charges a card ride on completion', async () => {
      const ride: any = RIDE_DOC({
        driver: DRIVER_ID,
        status: 'RIDE_STARTED',
        paymentMethod: 'CARD',
      });
      rideModel.findOne.mockResolvedValue(ride);

      const res: any = await service.complete(DRIVER_ID, { rideId: RIDE_ID });

      expect(res.statusCode).toBe(200);
      expect(ride.paymentStatus).toBe('PAID');
      expect(ride.paymentCollectedAt).toBeTruthy();
    });

    it('denies completing a ride that is not started', async () => {
      rideModel.findOne.mockResolvedValue(
        RIDE_DOC({ driver: DRIVER_ID, status: 'DRIVER_ASSIGNED' }),
      );

      const res: any = await service.complete(DRIVER_ID, { rideId: RIDE_ID });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('collectPayment', () => {
    it('marks the cash ride as paid and notifies the passenger', async () => {
      const ride: any = RIDE_DOC({
        driver: DRIVER_ID,
        status: 'RIDE_COMPLETED',
        paymentMethod: 'CASH',
      });
      rideModel.findOne.mockResolvedValue(ride);

      const res: any = await service.collectPayment(DRIVER_ID, {
        rideId: RIDE_ID,
        paymentMethod: 'CASH',
      });

      expect(res.statusCode).toBe(200);
      expect(ride.paymentStatus).toBe('PAID');
      expect(ride.paymentCollectedAt).toBeTruthy();
      expect(socketService.emitToRideAndActor).toHaveBeenCalledWith(
        USER_ID,
        RIDE_ID,
        'ride:payment',
        expect.objectContaining({ paymentStatus: 'PAID' }),
      );
    });

    it('denies collecting the payment twice', async () => {
      rideModel.findOne.mockResolvedValue(
        RIDE_DOC({
          driver: DRIVER_ID,
          status: 'RIDE_COMPLETED',
          paymentStatus: 'PAID',
        }),
      );

      const res: any = await service.collectPayment(DRIVER_ID, {
        rideId: RIDE_ID,
      });

      expect(res.statusCode).toBe(400);
      expect(res.message).toContain('already');
    });
  });

  describe('cancelRide', () => {
    it('cancels the ride as driver before the trip starts', async () => {
      const ride: any = RIDE_DOC({ driver: DRIVER_ID, status: 'DRIVER_ARRIVED' });
      rideModel.findOne.mockResolvedValue(ride);

      const res: any = await service.cancelRide(DRIVER_ID, {
        rideId: RIDE_ID,
        reason: 'Vehicle breakdown',
      });

      expect(res.statusCode).toBe(200);
      expect(ride.status).toBe('RIDE_CANCELLED');
      expect(ride.cancelledBy).toBe('DRIVER');
      expect(socketService.emitToRideAndActor).toHaveBeenCalledWith(
        USER_ID,
        RIDE_ID,
        'ride:cancelled',
        expect.objectContaining({ cancelledBy: 'DRIVER' }),
      );
    });

    it('denies cancelling a ride that has already started', async () => {
      rideModel.findOne.mockResolvedValue(
        RIDE_DOC({ driver: DRIVER_ID, status: 'RIDE_STARTED' }),
      );

      const res: any = await service.cancelRide(DRIVER_ID, {
        rideId: RIDE_ID,
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('activeRide', () => {
    it('returns null when the driver has no running ride', async () => {
      rideModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      const res: any = await service.activeRide(DRIVER_ID);

      expect(res.statusCode).toBe(200);
      expect(res.data).toBeNull();
    });
  });

  describe('earnings', () => {
    it('returns today, week and month totals from completed rides', async () => {
      rideModel.aggregate
        .mockResolvedValueOnce([
          { _id: null, totalEarned: 68.45, trips: 2 },
        ])
        .mockResolvedValueOnce([
          { _id: new Date().toISOString().slice(0, 10), earned: 68.45, trips: 2 },
        ]);

      const res: any = await service.earnings(DRIVER_ID, { range: 'WEEK' });

      expect(res.statusCode).toBe(200);
      expect(res.data.totalEarned).toBe(68.45);
      expect(res.data.today.earned).toBe(68.45);
      expect(res.data.rangeEarned).toBe(68.45);
      expect(res.data.currency).toBe('USD');
    });

    it('denies earnings for an unknown driver', async () => {
      driverModel.findById.mockResolvedValue(null);

      const res: any = await service.earnings(DRIVER_ID, {});

      expect(res.statusCode).toBe(404);
    });
  });
});
