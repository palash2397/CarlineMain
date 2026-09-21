import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import {
  VehicleType,
  VehicleTypeDocument,
} from './schema/vehicle-type.schema';
import { CreateVehicleTypeDto } from './dto/create-vehicle-type.dto';
import { UpdateVehicleTypeDto } from './dto/update-vehicle-type.dto';
import { UpdateVehicleTypeStatusDto } from './dto/update-vehicle-type-status.dto';
import { GetVehicleTypesQueryDto } from './dto/get-vehicle-types-query.dto';
import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';
import { deleteOldFile } from 'src/helpers/index';

@Injectable()
export class VehicleTypeService implements OnModuleInit {
  constructor(
    @InjectModel(VehicleType.name)
    private readonly vehicleTypeModel: Model<VehicleTypeDocument>,
  ) {}

  async onModuleInit() {
    await this.seedInitialVehicleTypes();
  }

  // Seed standard vehicle classes (ensuring all exist in database)
  private async seedInitialVehicleTypes() {
    try {
      const initialTypes = [
        {
          name: 'Sedan Comfort',
          seats: 4,
          badge: 'POPULAR',
          etaText: '3-5 min',
          basePrice: 18.3,
          perKmRate: 1.8,
          perMinuteRate: 0.4,
          image:
            'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&q=80',
          description: 'Comfortable 4-seat everyday sedan',
          status: 'Active',
          sortOrder: 1,
        },
        {
          name: 'SUV 6-Seater',
          seats: 6,
          badge: null,
          etaText: '5-8 min',
          basePrice: 26.8,
          perKmRate: 2.4,
          perMinuteRate: 0.5,
          image:
            'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=400&q=80',
          description: 'Spacious 6-seat SUV for family and luggage',
          status: 'Active',
          sortOrder: 2,
        },
        {
          name: 'Eco EV Green',
          seats: 4,
          badge: 'ECO',
          etaText: '4-6 min',
          basePrice: 20.1,
          perKmRate: 1.9,
          perMinuteRate: 0.4,
          image:
            'https://images.unsplash.com/photo-1563720223185-11003d516935?w=400&q=80',
          description: 'Zero-emission electric vehicle ride',
          status: 'Active',
          sortOrder: 3,
        },
        {
          name: 'VIP Executive',
          seats: 4,
          badge: 'VIP',
          etaText: '6-10 min',
          basePrice: 39.25,
          perKmRate: 3.2,
          perMinuteRate: 0.8,
          image:
            'https://images.unsplash.com/photo-1555353540-64580b51c258?w=400&q=80',
          description: 'Premium luxury executive sedan',
          status: 'Active',
          sortOrder: 4,
        },
        {
          name: 'Van 8-Seater XL',
          seats: 8,
          badge: 'EXTRA SPACE',
          etaText: '7-12 min',
          basePrice: 34.5,
          perKmRate: 2.8,
          perMinuteRate: 0.6,
          image:
            'https://images.unsplash.com/photo-1559297434-fae8a1916a79?w=400&q=80',
          description: 'Extra spacious passenger van for large groups and luggage',
          status: 'Active',
          sortOrder: 5,
        },
        {
          name: 'Wheelchair Accessible (WAV)',
          seats: 4,
          badge: 'ACCESSIBLE',
          etaText: '5-10 min',
          basePrice: 22.0,
          perKmRate: 2.0,
          perMinuteRate: 0.45,
          image:
            'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=400&q=80',
          description: 'Wheelchair ramp accessible vehicle for special assistance',
          status: 'Active',
          sortOrder: 6,
        },
      ];

      for (const item of initialTypes) {
        const existing = await this.vehicleTypeModel.findOne({
          name: { $regex: new RegExp(`^${item.name}$`, 'i') },
        });
        if (!existing) {
          await this.vehicleTypeModel.create(item);
          console.log(`🚗 Seeded vehicle type: ${item.name}`);
        }
      }
    } catch (error) {
      console.error('Error while seeding vehicle types:', error);
    }
  }

  // ==========================================
  // SuperAdmin Operations
  // ==========================================
  async createVehicleType(
    dto: CreateVehicleTypeDto,
    file?: Express.Multer.File,
    user?: any,
  ) {
    try {
      const trimmedName = dto.name.trim();

      // Check unique name
      const existing = await this.vehicleTypeModel.findOne({
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
      });
      if (existing) {
        return new ApiResponse(409, {}, Msg.VEHICLE_TYPE_ALREADY_EXISTS);
      }

      const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
      let imageUrl = dto.imageUrl?.trim() || null;

      if (file) {
        imageUrl = `${baseUrl}/api/v1/uploads/vehicle-types/${file.filename}`;
      }

      const created = await this.vehicleTypeModel.create({
        name: trimmedName,
        seats: Number(dto.seats) || 4,
        badge: dto.badge?.trim() || null,
        etaText: dto.etaText?.trim() || null,
        basePrice: Number(dto.basePrice) || 0,
        perKmRate: dto.perKmRate !== undefined ? Number(dto.perKmRate) : null,
        perMinuteRate:
          dto.perMinuteRate !== undefined ? Number(dto.perMinuteRate) : null,
        image: imageUrl,
        description: dto.description?.trim() || null,
        status: dto.status || 'Active',
        sortOrder: dto.sortOrder !== undefined ? Number(dto.sortOrder) : 0,
        createdBy: user?.email || user?.id || null,
      });

      return new ApiResponse(201, created, Msg.VEHICLE_TYPE_CREATED);
    } catch (error: any) {
      console.error('Error while creating vehicle type:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  async getVehicleTypes(query: GetVehicleTypesQueryDto) {
    try {
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.max(1, Number(query.limit) || 10);
      const skip = (page - 1) * limit;

      const filter: any = {};

      if (query.search && query.search.trim()) {
        const searchRegex = new RegExp(query.search.trim(), 'i');
        filter.$or = [
          { name: searchRegex },
          { badge: searchRegex },
          { description: searchRegex },
        ];
      }

      if (query.status && query.status !== 'All') {
        filter.status = query.status;
      }

      const [totalCount, vehicleTypes] = await Promise.all([
        this.vehicleTypeModel.countDocuments(filter),
        this.vehicleTypeModel
          .find(filter)
          .sort({ sortOrder: 1, createdAt: -1 })
          .skip(skip)
          .limit(limit),
      ]);

      const totalPages = Math.ceil(totalCount / limit) || 1;

      return new ApiResponse(
        200,
        {
          vehicleTypes,
          totalCount,
          totalPages,
          currentPage: page,
          limit,
        },
        Msg.VEHICLE_TYPES_FETCHED,
      );
    } catch (error: any) {
      console.error('Error while getting vehicle types:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  async getVehicleTypeById(id: string) {
    try {
      if (!isValidObjectId(id)) {
        return new ApiResponse(400, {}, Msg.INVALID_INPUT);
      }

      const vehicleType = await this.vehicleTypeModel.findById(id);
      if (!vehicleType) {
        return new ApiResponse(404, {}, Msg.VEHICLE_TYPE_NOT_FOUND);
      }

      return new ApiResponse(200, vehicleType, Msg.DATA_FETCHED);
    } catch (error: any) {
      console.error('Error while getting vehicle type by id:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  async updateVehicleType(
    id: string,
    dto: UpdateVehicleTypeDto,
    file?: Express.Multer.File,
  ) {
    try {
      if (!isValidObjectId(id)) {
        return new ApiResponse(400, {}, Msg.INVALID_INPUT);
      }

      const vehicleType = await this.vehicleTypeModel.findById(id);
      if (!vehicleType) {
        return new ApiResponse(404, {}, Msg.VEHICLE_TYPE_NOT_FOUND);
      }

      if (dto.name && dto.name.trim() !== vehicleType.name) {
        const trimmedName = dto.name.trim();
        const existing = await this.vehicleTypeModel.findOne({
          name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
          _id: { $ne: id },
        });
        if (existing) {
          return new ApiResponse(409, {}, Msg.VEHICLE_TYPE_ALREADY_EXISTS);
        }
        vehicleType.name = trimmedName;
      }

      if (dto.seats !== undefined) vehicleType.seats = Number(dto.seats);
      if (dto.badge !== undefined) vehicleType.badge = dto.badge?.trim() || null;
      if (dto.etaText !== undefined)
        vehicleType.etaText = dto.etaText?.trim() || null;
      if (dto.basePrice !== undefined)
        vehicleType.basePrice = Number(dto.basePrice);
      if (dto.perKmRate !== undefined)
        vehicleType.perKmRate = Number(dto.perKmRate);
      if (dto.perMinuteRate !== undefined)
        vehicleType.perMinuteRate = Number(dto.perMinuteRate);
      if (dto.description !== undefined)
        vehicleType.description = dto.description?.trim() || null;
      if (dto.status !== undefined) vehicleType.status = dto.status;
      if (dto.sortOrder !== undefined)
        vehicleType.sortOrder = Number(dto.sortOrder);

      if (file) {
        const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
        vehicleType.image = `${baseUrl}/api/v1/uploads/vehicle-types/${file.filename}`;
      } else if (dto.imageUrl !== undefined) {
        vehicleType.image = dto.imageUrl?.trim() || null;
      }

      await vehicleType.save();

      return new ApiResponse(200, vehicleType, Msg.VEHICLE_TYPE_UPDATED);
    } catch (error: any) {
      console.error('Error while updating vehicle type:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  async updateVehicleTypeStatus(dto: UpdateVehicleTypeStatusDto) {
    try {
      if (!isValidObjectId(dto.id)) {
        return new ApiResponse(400, {}, Msg.INVALID_INPUT);
      }

      const vehicleType = await this.vehicleTypeModel.findByIdAndUpdate(
        dto.id,
        { status: dto.status },
        { new: true },
      );

      if (!vehicleType) {
        return new ApiResponse(404, {}, Msg.VEHICLE_TYPE_NOT_FOUND);
      }

      return new ApiResponse(200, vehicleType, Msg.VEHICLE_TYPE_STATUS_UPDATED);
    } catch (error: any) {
      console.error('Error while updating vehicle type status:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  async deleteVehicleType(id: string) {
    try {
      if (!isValidObjectId(id)) {
        return new ApiResponse(400, {}, Msg.INVALID_INPUT);
      }

      const deleted = await this.vehicleTypeModel.findByIdAndDelete(id);
      if (!deleted) {
        return new ApiResponse(404, {}, Msg.VEHICLE_TYPE_NOT_FOUND);
      }

      return new ApiResponse(200, {}, Msg.VEHICLE_TYPE_DELETED);
    } catch (error: any) {
      console.error('Error while deleting vehicle type:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }

  // ==========================================
  // Public / Selection Operations
  // (For Driver Registration & Customer Booking)
  // ==========================================
  async getActiveVehicleTypes() {
    try {
      const activeTypes = await this.vehicleTypeModel
        .find({ status: 'Active' })
        .sort({ sortOrder: 1, createdAt: 1 })
        .select('-__v');

      return new ApiResponse(200, activeTypes, Msg.VEHICLE_TYPES_FETCHED);
    } catch (error: any) {
      console.error('Error while fetching active vehicle types:', error);
      return new ApiResponse(500, {}, error.message || Msg.SERVER_ERROR);
    }
  }
}
