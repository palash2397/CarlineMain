import { RideStatus } from 'src/common/enums/ride/ride-status.enum';

export default {
  SWAGGER: {
    TITLE: 'Carline Main API',
    DESCRIPTION: 'API documentation for Carline Main System',
    VERSION: '1.0',
    SERVER_URL: '',
  },

  Global: {
    PREFIX: '/api/v1',
  },
};

// ---------------------------------------------------------------
// Ride booking (passenger app + driver app) shared values.
// ---------------------------------------------------------------
export const ROAD_DISTANCE_FACTOR = 1.3;
export const AVERAGE_SPEED_KMH = 25;
export const DRIVER_SEARCH_RADIUS_KM = 5;
export const KM_PER_MILE = 1.609344;
export const DEFAULT_CURRENCY = 'USD';
export const MAX_PASSENGERS = 8;
export const DRIVER_REQUEST_LIMIT = 20;

// A scheduled ride moves to driver search this many minutes before its pickup
// time, so the driver reaches the pickup point on time.
export const SCHEDULED_DISPATCH_LEAD_MINUTES = 15;

// How many due scheduled rides one scheduler run promotes.
export const SCHEDULED_DISPATCH_BATCH_SIZE = 50;

// A recurring booking creates the ride of its next pickup this many minutes
// before the pickup time. From there the normal scheduled dispatch takes over,
// so a recurring ride reaches the drivers exactly like a one time ride.
export const RECURRING_MATERIALIZE_LEAD_MINUTES = 60;

// How many recurring series one scheduler run turns into a ride.
export const RECURRING_DISPATCH_BATCH_SIZE = 50;

// How far ahead the next pickup of a series is looked up (one year of days).
export const RECURRING_LOOKAHEAD_DAYS = 370;

// Socket events shared by the passenger app and the driver app.
export const RIDE_EVENTS = {
  CREATED: 'ride:created',
  STATUS: 'ride:status',
  DRIVER: 'ride:driver',
  DRIVER_LOCATION: 'ride:driverLocation',
  CANCELLED: 'ride:cancelled',
  COMPLETED: 'ride:completed',
  REQUEST: 'ride:request',
  TAKEN: 'ride:taken',
  PAYMENT: 'ride:payment',
};

export const DRIVER_ROOM = 'drivers';

// Online drivers of one vehicle type get their own room, so a Sedan driver never
// receives an SUV request.
export const driverRoomFor = (vehicleTypeId: string) => `drivers:${vehicleTypeId}`;

// Statuses in which a ride is running with a driver (the driver is busy).
export const DRIVER_RUNNING_STATUSES = [
  RideStatus.DRIVER_ASSIGNED,
  RideStatus.DRIVER_ARRIVED,
  RideStatus.RIDE_STARTED,
];
