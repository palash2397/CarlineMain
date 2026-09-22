import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserAddressService } from './user-address.service';
import { UserAddressController } from './user-address.controller';

import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/modules/user/schema/user.schema';
import { Address, AddressSchema } from 'src/modules/user/schema/address.schema';
import {
  CompanyUser,
  CompanyUserSchema,
} from '../company-user/schema/company-user.schema';
import { Company, CompanySchema } from '../super-admin/schema/company.schema';
import { Driver, DriverSchema } from '../driver/schema/driver.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: CompanyUser.name, schema: CompanyUserSchema },
      { name: Company.name, schema: CompanySchema },
      { name: Driver.name, schema: DriverSchema },
      { name: Address.name, schema: AddressSchema },
    ]),
    MailModule,
  ],
  controllers: [UserController, UserAddressController],
  providers: [UserService, UserAddressService],
  exports: [UserService],
})
export class UserModule {}
