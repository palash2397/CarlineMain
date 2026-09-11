import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';

import { Support, SupportDocument } from './schema/support.schema';
import { CreateSupportDto } from './dto/create-support.dto';
import { UpdateSupportDto } from './dto/update-support.dto';

@Injectable()
export class SupportService {
  constructor(
    @InjectModel(Support.name) private supportModel: Model<SupportDocument>,
  ) {}

  async createTicket(userId: string, dto: CreateSupportDto) {
    try {
      const ticket = new this.supportModel({
        user: userId,
        message: dto.message,
      });
      await ticket.save();
      return new ApiResponse(201, {}, Msg.SUPPORT_CREATED);
    } catch (error) {
      console.log('Error creating support ticket:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async getMyTickets(userId: string) {
    try {
      const tickets = await this.supportModel
        .find({ user: userId })
        .sort({ createdAt: -1 });

      if (!tickets || tickets.length === 0) {
        return new ApiResponse(404, {}, Msg.SUPPORT_NOT_FOUND);
      }
      return new ApiResponse(200, tickets, Msg.SUPPORT_FETCHED);
    } catch (error) {
      console.log('Error fetching my support tickets:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async getAllTickets() {
    try {
      // Admin route, populate user data to see who requested support
      const tickets = await this.supportModel
        .find()
        .populate('user', 'firstName lastName email phoneNumber')
        .sort({ createdAt: -1 });

      if (!tickets || tickets.length === 0) {
        return new ApiResponse(404, {}, Msg.SUPPORT_NOT_FOUND);
      }
      return new ApiResponse(200, tickets, Msg.SUPPORT_FETCHED);
    } catch (error) {
      console.log('Error fetching all support tickets:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async updateTicketStatus(id: string, dto: UpdateSupportDto) {
    try {
      const ticket = await this.supportModel.findByIdAndUpdate(id, dto, {
        new: true,
      });
      if (!ticket) {
        return new ApiResponse(404, {}, Msg.SUPPORT_NOT_FOUND);
      }
      return new ApiResponse(200, ticket, Msg.SUPPORT_UPDATED);
    } catch (error) {
      console.log('Error updating support ticket:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }
}
