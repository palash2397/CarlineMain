import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyUserController } from './company-user.controller';
import { CompanyUserService } from './company-user.service';
import { CompanyTripsController } from './company-trips.controller';
import { CompanyTripsService } from './company-trips.service';
import { CompanyCustomersController } from './company-customers.controller';
import { CompanyCustomersService } from './company-customers.service';

import { User, UserSchema } from '../user/schema/user.schema';
import { Company, CompanySchema } from '../super-admin/schema/company.schema';
import { CompanyUser, CompanyUserSchema } from './schema/company-user.schema';
import { Ride, RideSchema } from '../ride/schema/ride.schema';
import { Driver, DriverSchema } from '../driver/schema/driver.schema';
import { Customer, CustomerSchema } from '../customer/schema/customer.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Company.name, schema: CompanySchema },
      { name: CompanyUser.name, schema: CompanyUserSchema },
      { name: Ride.name, schema: RideSchema },
      { name: Driver.name, schema: DriverSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
    MailModule,
  ],
  controllers: [
    CompanyUserController,
    CompanyTripsController,
    CompanyCustomersController,
  ],
  providers: [
    CompanyUserService,
    CompanyTripsService,
    CompanyCustomersService,
  ],
  exports: [
    CompanyUserService,
    CompanyTripsService,
    CompanyCustomersService,
    MongooseModule,
  ],
})
export class CompanyUserModule {}
