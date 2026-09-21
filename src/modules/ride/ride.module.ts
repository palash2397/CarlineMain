import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Driver, DriverSchema } from '../driver/schema/driver.schema';
import { Pricing, PricingSchema } from '../pricing/schema/pricing.schema';
import {
  VehicleType,
  VehicleTypeSchema,
} from '../vehicle-type/schema/vehicle-type.schema';

import { User, UserSchema } from '../user/schema/user.schema';

import { Promo, PromoSchema } from './schema/promo.schema';
import { Ride, RideSchema } from './schema/ride.schema';
import { RideController } from './ride.controller';
import { RideService } from './ride.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ride.name, schema: RideSchema },
      { name: Promo.name, schema: PromoSchema },
      { name: VehicleType.name, schema: VehicleTypeSchema },
      { name: Driver.name, schema: DriverSchema },
      { name: Pricing.name, schema: PricingSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [RideController],
  providers: [RideService],
  exports: [RideService],
})
export class RideModule {}
