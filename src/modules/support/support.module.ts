import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Support, SupportSchema } from './schema/support.schema';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Support.name, schema: SupportSchema }]),
  ],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [
    MongooseModule.forFeature([{ name: Support.name, schema: SupportSchema }]),
  ],
})
export class SupportModule {}
