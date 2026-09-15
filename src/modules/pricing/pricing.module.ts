import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Pricing, PricingSchema } from './schema/pricing.schema';
import {
  Company,
  CompanySchema,
} from '../super-admin/schema/company.schema';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Pricing.name, schema: PricingSchema },
      { name: Company.name, schema: CompanySchema },
    ]),
  ],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
