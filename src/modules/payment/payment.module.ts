import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';

import {
  PaymentTransaction,
  PaymentTransactionSchema,
} from './schema/payment-transaction.schema';
import { Customer, CustomerSchema } from '../customer/schema/customer.schema';
import { Ride, RideSchema } from '../ride/schema/ride.schema';

import { UsaepayService } from './usaepay.service';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
      { name: Customer.name, schema: CustomerSchema },
      { name: Ride.name, schema: RideSchema },
    ]),
  ],
  controllers: [PaymentController],
  providers: [UsaepayService, PaymentService],
  exports: [PaymentService, UsaepayService],
})
export class PaymentModule {}
