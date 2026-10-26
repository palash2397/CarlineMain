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

export const ROAD_DISTANCE_FACTOR = 1.3;
export const AVERAGE_SPEED_KMH = 25;
export const DRIVER_SEARCH_RADIUS_KM = 5;
export const KM_PER_MILE = 1.609344;
export const DEFAULT_CURRENCY = 'USD';
export const MAX_PASSENGERS = 8;
export const DRIVER_REQUEST_LIMIT = 20;

export const SCHEDULED_DISPATCH_LEAD_MINUTES = 15;

export const SCHEDULED_DISPATCH_BATCH_SIZE = 50;

export const RECURRING_MATERIALIZE_LEAD_MINUTES = 60;

export const RECURRING_DISPATCH_BATCH_SIZE = 50;

export const RECURRING_LOOKAHEAD_DAYS = 370;

export const DRIVER_REQUEST_TIMEOUT_SECONDS = 30;

export const DEFAULT_FREE_WAITING_MINUTES = 5;
export const DEFAULT_WAITING_CHARGE_PER_MINUTE = 0.3;

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
  ASSIGNED: 'ride:assigned',
  UPDATED: 'ride:updated',
  EXPIRED: 'ride:expired',
  MISSED: 'ride:missed',
  TRANSFERRED: 'ride:transferred',
  DESTINATION_REACHED: 'ride:destinationReached',
  FINAL_FARE: 'ride:finalFare',
  WAITING: 'ride:waiting',
};

export const DRIVER_ROOM = 'drivers';

export const driverRoomFor = (vehicleTypeId: string) =>
  `drivers:${vehicleTypeId}`;

export const DRIVER_RUNNING_STATUSES = [
  RideStatus.DRIVER_ASSIGNED,
  RideStatus.DRIVER_ARRIVED,
  RideStatus.RIDE_STARTED,
];
