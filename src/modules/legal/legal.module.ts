import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Legal, LegalSchema } from './schema/legal.schema';
import { LegalService } from './legal.service';
import { LegalController } from './legal.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Legal.name, schema: LegalSchema }]),
  ],
  controllers: [LegalController],
  providers: [LegalService],
  exports: [LegalService],
})
export class LegalModule {}
