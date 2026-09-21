import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { VehicleType, VehicleTypeDocument } from './schema/vehicle-type.schema';
import { CreateVehicleTypeDto } from './dto/create-vehicle-type.dto';
import { UpdateVehicleTypeDto } from './dto/update-vehicle-type.dto';
import { UpdateVehicleTypeStatusDto } from './dto/update-vehicle-type-status.dto';
import { GetVehicleTypesQueryDto } from './dto/get-vehicle-types-query.dto';
import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';
import { deleteOldFile } from 'src/helpers/index';

@Injectable()
export class VehicleTypeService {
  constructor(
    @InjectModel(VehicleType.name)
    private readonly vehicleTypeModel: Model<VehicleTypeDocument>,
  ) {}

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
    dto: UpdateVehicleTypeDto,
    file?: Express.Multer.File,
  ) {
    try {
      if (!isValidObjectId(dto.id)) {
        return new ApiResponse(400, {}, Msg.INVALID_INPUT);
      }

      const vehicleType = await this.vehicleTypeModel.findById(dto.id);
      if (!vehicleType) {
        return new ApiResponse(404, {}, Msg.VEHICLE_TYPE_NOT_FOUND);
      }

      if (dto.name && dto.name.trim() !== vehicleType.name) {
        const trimmedName = dto.name.trim();
        const existing = await this.vehicleTypeModel.findOne({
          name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
          _id: { $ne: dto.id },
        });
        if (existing) {
          return new ApiResponse(409, {}, Msg.VEHICLE_TYPE_ALREADY_EXISTS);
        }
        vehicleType.name = trimmedName;
      }

      if (dto.seats !== undefined) vehicleType.seats = Number(dto.seats);
      if (dto.badge !== undefined)
        vehicleType.badge = dto.badge?.trim() || null;
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

  async findVehicleTypeByIdOrName(idOrName: string) {
    if (!idOrName) return null;
    const trimmed = idOrName.trim();
    if (isValidObjectId(trimmed)) {
      const byId = await this.vehicleTypeModel.findById(trimmed);
      if (byId) return byId;
    }
    return this.vehicleTypeModel.findOne({
      name: { $regex: new RegExp(`^${trimmed}$`, 'i') },
    });
  }
}
