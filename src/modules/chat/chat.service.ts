import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Socket, Server } from 'socket.io';

import { RideStatus } from 'src/common/enums/ride/ride-enum';

import { User, UserDocument } from 'src/modules/user/schema/user.schema';
import { ChatMessage, ChatMessageDocument } from './schema/chat-message.schema';

import { JoinChatDto } from './dto/join-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';

import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,

    @InjectModel(ChatMessage.name)
    private readonly chatMessageModel: Model<ChatMessageDocument>,
  ) {}

  // async joinRideChat(client: Socket, dto: JoinChatDto) {
  //   try {
  //     const userId = client.data.user.id;

  //     const ride = await this.rideModel.findById(dto.rideId).populate('driver');

  //     if (!ride) {
  //       return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
  //     }

  //     if (!ride.driver) {
  //       return new ApiResponse(400, {}, Msg.DRIVER_NOT_ASSIGNED);
  //     }

  //     const isPassenger = ride.user.toString() === userId;
  //     const isDriver =
  //       ride.driver && (ride.driver as any).user.toString() === userId;

  //     console.log(`isDriver --->`, isDriver);
  //     console.log(`isPassenger --->`, isPassenger);
  //     if (!isPassenger && !isDriver) {
  //       return new ApiResponse(401, {}, Msg.UNAUTHORIZED);
  //     }

  //     const allowedStatuses = [
  //       RideStatus.DRIVER_FOUND,
  //       RideStatus.DRIVER_ARRIVED,
  //       RideStatus.ONGOING,
  //       RideStatus.PAYMENT_PENDING,
  //     ];

  //     if (!allowedStatuses.includes(ride.status)) {
  //       return new ApiResponse(400, {}, Msg.CHAT_IS_NOT_AVAILABLE);
  //     }

  //     const roomName = `ride:${ride._id}`;

  //     client.join(roomName);

  //     console.log(`${userId} joined ${roomName}`);

  //     return new ApiResponse(200, {}, Msg.CHAT_JOINED);
  //   } catch (error) {
  //     console.log('Error in joinRideChat:', error);
  //     return new ApiResponse(500, {}, Msg.SERVER_ERROR);
  //   }
  // }

  // async sendMessage(client: Socket, dto: SendMessageDto, server: Server) {
  //   try {
  //     const userId = client.data.user.id;
  //     const ride = await this.rideModel.findById(dto.rideId).populate('driver');

  //     if (!ride) {
  //       return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
  //     }

  //     const isPassenger = ride.user.toString() === userId;
  //     const isDriver =
  //       ride.driver && (ride.driver as any).user.toString() === userId;

  //     if (!isPassenger && !isDriver) {
  //       return new ApiResponse(401, {}, Msg.UNAUTHORIZED);
  //     }

  //     const receiverId = isPassenger
  //       ? (ride.driver as any).user.toString()
  //       : ride.user.toString();

  //     const message = await this.chatMessageModel.create({
  //       ride: ride._id,
  //       sender: userId,
  //       receiver: receiverId,
  //       message: dto.message,
  //       messageType: dto.messageType,
  //     });

  //     let chatMessage = (await this.chatMessageModel
  //       .findById(message._id)
  //       .populate('sender', 'firstName lastName avatar')
  //       .lean()) as any;

  //     if (chatMessage?.sender) {
  //       const sender = chatMessage.sender as any;
  //       if (sender.avatar && !sender.avatar.startsWith('http')) {
  //         const baseUrl = process.env.BASE_URL;
  //         sender.avatar = `${baseUrl}/api/v1/uploads/profile/${sender.avatar}`;
  //       } else if (!sender.avatar) {
  //         sender.avatar = process.env.DEFAULT_IMAGE;
  //       }
  //     }

  //     server.to(`ride:${ride._id}`).emit('newMessage', chatMessage);

  //     return new ApiResponse(200, chatMessage, Msg.MESSAGE_SENT);
  //   } catch (error) {
  //     console.log('Error in sendMessage:', error);
  //     return new ApiResponse(500, {}, Msg.SERVER_ERROR);
  //   }
  // }

  // async getMessages(
  //   userId: string,
  //   rideId: string,
  //   page: number = 1,
  //   limit: number = 10,
  // ) {
  //   try {
  //     const ride = await this.rideModel.findById(rideId).populate('driver');

  //     if (!ride) {
  //       return new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND);
  //     }

  //     const isPassenger = ride.user.toString() === userId;
  //     const isDriver =
  //       ride.driver && (ride.driver as any).user.toString() === userId;

  //     if (!isPassenger && !isDriver) {
  //       return new ApiResponse(401, {}, Msg.UNAUTHORIZED);
  //     }

  //     const totalMessages = await this.chatMessageModel.countDocuments({
  //       ride: rideId,
  //     });
  //     const totalPages = Math.ceil(totalMessages / limit);

  //     let messages = (await this.chatMessageModel
  //       .find({
  //         ride: rideId,
  //       })
  //       .populate('sender', 'firstName lastName avatar')
  //       .sort({
  //         createdAt: -1,
  //       })
  //       .skip((page - 1) * limit)
  //       .limit(limit)
  //       .lean()) as any[];

  //     // Reverse messages so they display chronologically in the UI (oldest at top, newest at bottom)
  //     messages = messages.reverse();

  //     const baseUrl = process.env.BASE_URL;
  //     messages = messages.map((msg) => {
  //       if (msg.sender) {
  //         if (msg.sender.avatar && !msg.sender.avatar.startsWith('http')) {
  //           msg.sender.avatar = `${baseUrl}/api/v1/uploads/profile/${msg.sender.avatar}`;
  //         } else if (!msg.sender.avatar) {
  //           msg.sender.avatar = process.env.DEFAULT_IMAGE;
  //         }
  //       }
  //       return msg;
  //     });

  //     return new ApiResponse(
  //       200,
  //       {
  //         messages,
  //         pagination: {
  //           totalMessages,
  //           totalPages,
  //           currentPage: Number(page),
  //           limit: Number(limit),
  //         },
  //       },
  //       Msg.CHAT_FETCHED,
  //     );
  //   } catch (error) {
  //     console.log(error);

  //     return new ApiResponse(500, {}, Msg.SERVER_ERROR);
  //   }
  // }
}
