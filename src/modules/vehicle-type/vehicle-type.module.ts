import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  VehicleType,
  VehicleTypeSchema,
} from './schema/vehicle-type.schema';
import { VehicleTypeController } from './vehicle-type.controller';
import { VehicleTypeService } from './vehicle-type.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VehicleType.name, schema: VehicleTypeSchema },
    ]),
  ],
  controllers: [VehicleTypeController],
  providers: [VehicleTypeService],
  exports: [VehicleTypeService, MongooseModule],
})
export class VehicleTypeModule {}
