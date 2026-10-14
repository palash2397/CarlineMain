import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { RideService } from './ride.service';

// A scheduled ride has to reach the drivers on server time, because the
// passenger app is not running for the whole wait. The job reads the due rides
// from the database on every run, so a pm2 reload never loses a ride.
@Injectable()
export class RideSchedulerService {
  private readonly logger = new Logger(RideSchedulerService.name);

  constructor(private readonly rideService: RideService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async promoteScheduledRides() {
    try {
      const promoted = await this.rideService.promoteDueScheduledRides();

      if (promoted) {
        this.logger.log(`Scheduled rides moved to driver search: ${promoted}`);
      }
    } catch (error) {
      this.logger.error(
        `Error while promoting scheduled rides: ${String(error)}`,
      );
    }
  }

  // A recurring booking is only a template, so its next ride is created here.
  // From that point the ride is a normal scheduled ride and the job above hands
  // it to the drivers.
  @Cron(CronExpression.EVERY_MINUTE)
  async createRecurringRides() {
    try {
      const created = await this.rideService.promoteDueRecurringRides();

      if (created) {
        this.logger.log(`Recurring rides created: ${created}`);
      }
    } catch (error) {
      this.logger.error(
        `Error while creating recurring rides: ${String(error)}`,
      );
    }
  }

  // Midnight reset job (raat ke 12:00 baje UK time) to reset driver today working hours / online stats to 0
  @Cron('0 0 * * *', {
    name: 'midnightDriverReset',
    timeZone: process.env.APP_TIMEZONE || 'Europe/London',
  })
  async resetDailyDriverOnlineStats() {
    try {
      await this.rideService.resetDailyDriverOnlineStats();
      this.logger.log('Daily driver online stats reset successfully at midnight UK time (12:00 AM Europe/London)');
    } catch (error) {
      this.logger.error(
        `Error while resetting driver daily online stats at midnight: ${String(error)}`,
      );
    }
  }
}

