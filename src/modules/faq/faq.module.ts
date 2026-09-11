import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Faq, FaqSchema } from './schema/faq.schema';
import { FaqService } from './faq.service';
import { FaqController } from './faq.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Faq.name, schema: FaqSchema }])],
  controllers: [FaqController],
  providers: [FaqService],
  exports: [MongooseModule.forFeature([{ name: Faq.name, schema: FaqSchema }])],
})
export class FaqModule {}
