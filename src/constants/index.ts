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