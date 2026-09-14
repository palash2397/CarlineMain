import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CompanyUserController } from './company-user.controller';
import { CompanyUserService } from './company-user.service';
import { User, UserSchema } from '../user/schema/user.schema';
import { Company, CompanySchema } from '../super-admin/schema/company.schema';
import { CompanyUser, CompanyUserSchema } from './schema/company-user.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Company.name, schema: CompanySchema },
      { name: CompanyUser.name, schema: CompanyUserSchema },
    ]),
    MailModule,
  ],
  controllers: [CompanyUserController],
  providers: [CompanyUserService],
  exports: [CompanyUserService, MongooseModule],
})
export class CompanyUserModule {}
