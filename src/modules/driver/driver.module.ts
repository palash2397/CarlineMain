import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Driver, DriverSchema } from './schema/driver.schema';
import { Company, CompanySchema } from '../super-admin/schema/company.schema';
import { CompanyUser, CompanyUserSchema } from '../company-user/schema/company-user.schema';
import { User, UserSchema } from '../user/schema/user.schema';
import { MailModule } from '../mail/mail.module';
import { DriverController } from './driver.controller';
import { DriverService } from './driver.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Driver.name, schema: DriverSchema },
      { name: Company.name, schema: CompanySchema },
      { name: CompanyUser.name, schema: CompanyUserSchema },
      { name: User.name, schema: UserSchema },
    ]),
    MailModule,
  ],
  controllers: [DriverController],
  providers: [DriverService],
  exports: [DriverService, MongooseModule],
})
export class DriverModule {}
