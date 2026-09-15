import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Driver, DriverSchema } from './schema/driver.schema';
import { DriverController } from './driver.controller';
import { DriverService } from './driver.service';
import { Company, CompanySchema } from '../super-admin/schema/company.schema';
import {
  CompanyUser,
  CompanyUserSchema,
} from '../company-user/schema/company-user.schema';

import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Driver.name, schema: DriverSchema },
      { name: Company.name, schema: CompanySchema },
      { name: CompanyUser.name, schema: CompanyUserSchema },
    ]),
    MailModule,
  ],
  controllers: [DriverController],
  providers: [DriverService],
  exports: [DriverService],
})
export class DriverModule {}
