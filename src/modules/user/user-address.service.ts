import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';

import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { Address, AddressDocument } from './schema/address.schema';

// Saved Places screen: the places one passenger keeps for one tap booking.
@Injectable()
export class UserAddressService {
  constructor(
    @InjectModel(Address.name)
    private readonly addressModel: Model<AddressDocument>,
  ) {}

  async addresses(userId: string) {
    try {
      const addresses = await this.addressModel
        .find({ user: userId })
        .sort({ createdAt: -1 });

      return new ApiResponse(
        200,
        {
          count: addresses.length,
          addresses: addresses.map((address) => this.addressPayload(address)),
        },
        Msg.ADDRESS_FETCHED,
      );
    } catch (error) {
      console.log('error while fetching addresses', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    try {
      const existing = await this.addressModel.findOne({
        user: userId,
        label: dto.label,
      });

      if (existing) {
        return new ApiResponse(400, {}, Msg.ADDRESS_ALREADY_EXISTS);
      }

      const address = await this.addressModel.create({
        user: userId,
        label: dto.label,
        address: dto.address,
        type: dto.type,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
      });

      return new ApiResponse(
        200,
        this.addressPayload(address),
        Msg.ADDRESS_CREATED,
      );
    } catch (error) {
      console.log('error while saving address', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ) {
    try {
      const found: any = await this.addressOrError(userId, addressId);

      if (found.error) {
        return found.error;
      }

      const { address } = found;

      if (dto.label && dto.label !== address.label) {
        const duplicate = await this.addressModel.findOne({
          _id: { $ne: address._id },
          user: userId,
          label: dto.label,
        });

        if (duplicate) {
          return new ApiResponse(400, {}, Msg.ADDRESS_ALREADY_EXISTS);
        }
      }

      if (dto.label !== undefined) address.label = dto.label;
      if (dto.address !== undefined) address.address = dto.address;
      if (dto.type !== undefined) address.type = dto.type;
      if (dto.latitude !== undefined) address.latitude = dto.latitude;
      if (dto.longitude !== undefined) address.longitude = dto.longitude;

      await address.save();

      return new ApiResponse(
        200,
        this.addressPayload(address),
        Msg.ADDRESS_UPDATED,
      );
    } catch (error) {
      console.log('error while updating address', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async deleteAddress(userId: string, addressId: string) {
    try {
      const found: any = await this.addressOrError(userId, addressId);

      if (found.error) {
        return found.error;
      }

      await this.addressModel.deleteOne({ _id: found.address._id });

      return new ApiResponse(
        200,
        { addressId: String(found.address._id) },
        Msg.ADDRESS_DELETED,
      );
    } catch (error) {
      console.log('error while deleting address', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // Only the owner can read or change a saved address.
  private async addressOrError(userId: string, addressId: string) {
    if (!Types.ObjectId.isValid(addressId)) {
      return { error: new ApiResponse(404, {}, Msg.ADDRESS_NOT_FOUND) };
    }

    const address = await this.addressModel.findOne({
      _id: addressId,
      user: userId,
    });

    if (!address) {
      return { error: new ApiResponse(404, {}, Msg.ADDRESS_NOT_FOUND) };
    }

    return { address };
  }

  private addressPayload(address: any) {
    return {
      addressId: String(address._id),
      label: address.label,
      address: address.address,
      type: address.type,
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
      createdAt: address.createdAt || null,
      updatedAt: address.updatedAt || null,
    };
  }
}
