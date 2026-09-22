import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

import { Ride, RideSchema } from '../ride/schema/ride.schema';
import { Driver, DriverSchema } from '../driver/schema/driver.schema';
import { Company, CompanySchema } from '../super-admin/schema/company.schema';
import {
  CompanyUser,
  CompanyUserSchema,
} from '../company-user/schema/company-user.schema';
import { User, UserSchema } from '../user/schema/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ride.name, schema: RideSchema },
      { name: Driver.name, schema: DriverSchema },
      { name: Company.name, schema: CompanySchema },
      { name: CompanyUser.name, schema: CompanyUserSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
