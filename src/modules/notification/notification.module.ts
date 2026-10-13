import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/schema/user.schema';
import { Driver, DriverSchema } from '../driver/schema/driver.schema';
import {
  Notification,
  NotificationSchema,
} from './schema/notification.schema';
import { Broadcast, BroadcastSchema } from './schema/broadcast.schema';
import { Ride, RideSchema } from '../ride/schema/ride.schema';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: Broadcast.name, schema: BroadcastSchema },
      { name: Ride.name, schema: RideSchema },
      { name: User.name, schema: UserSchema },
      { name: Driver.name, schema: DriverSchema },
    ]),
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
