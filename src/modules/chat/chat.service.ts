import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';
import { SocketService } from '../socket/socket.service';
import { User, UserDocument } from '../user/schema/user.schema';
import { Driver, DriverDocument } from '../driver/schema/driver.schema';
import { Ride, RideDocument } from '../ride/schema/ride.schema';
import { ChatMessage, ChatMessageDocument } from './schema/chat-message.schema';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatMessage.name)
    private readonly chatMessageModel: Model<ChatMessageDocument>,

    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,

    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,

    @InjectModel(Ride.name)
    private readonly rideModel: Model<RideDocument>,

    private readonly socketService: SocketService,
  ) {}

  /**
   * Helper to verify if user is passenger or assigned driver for the ride
   */
  private async getRideAndVerifyAccess(userId: string, rideId: string) {
    const ride = await this.rideModel.findById(rideId);
    if (!ride) {
      return { error: new ApiResponse(404, {}, Msg.RIDE_NOT_FOUND) };
    }

    const isPassenger = String(ride.user) === String(userId);
    const isDriver = ride.driver && String(ride.driver) === String(userId);

    if (!isPassenger && !isDriver) {
      const message = !ride.driver
        ? 'Driver is not assigned to this ride yet. Please accept or assign a driver first.'
        : 'You are not authorized to access chat for this ride';
      return {
        error: new ApiResponse(403, {}, message),
      };
    }

    return {
      ride,
      isPassenger,
      isDriver,
      senderRole: isPassenger ? 'PASSENGER' : 'DRIVER',
      receiverId: isPassenger ? (ride.driver ? String(ride.driver) : null) : String(ride.user),
    };
  }

  /**
   * Send a chat message (via REST or Socket)
   */
  async sendMessage(userId: string, roles: any, dto: SendMessageDto) {
    try {
      if (!dto.message || !dto.message.trim()) {
        return new ApiResponse(400, {}, 'Message content cannot be empty');
      }

      const access = await this.getRideAndVerifyAccess(userId, dto.rideId);
      if (access.error) {
        return access.error;
      }

      const { ride, isPassenger, senderRole, receiverId } = access;

      // Resolve sender name and avatar
      let senderName = senderRole === 'DRIVER' ? 'Driver' : 'Passenger';
      let senderAvatar: string | null = null;

      if (isPassenger) {
        const user = await this.userModel.findById(userId).lean();
        if (user) {
          senderName =
            (user as any).fullName ||
            `${(user as any).firstName || ''} ${(user as any).lastName || ''}`.trim() ||
            (user as any).phoneNumber ||
            'Passenger';
          senderAvatar = (user as any).avatar || null;
        }
      } else {
        const driver = await this.driverModel.findById(userId).lean();
        if (driver) {
          senderName =
            (driver as any).fullName ||
            `${(driver as any).firstName || ''} ${(driver as any).lastName || ''}`.trim() ||
            'Driver';
          senderAvatar = (driver as any).profilePicture || (driver as any).avatar || null;
        }
      }

      // Save message in DB
      const messageDoc = await this.chatMessageModel.create({
        rideId: String(ride._id),
        ride: String(ride._id),
        senderId: String(userId),
        sender: String(userId),
        receiverId: receiverId ? String(receiverId) : null,
        receiver: receiverId ? String(receiverId) : null,
        senderRole,
        senderName,
        senderAvatar,
        message: dto.message.trim(),
        isRead: false,
      });

      const messagePayload = {
        _id: String(messageDoc._id),
        rideId: String(ride._id),
        senderId: String(userId),
        receiverId: receiverId ? String(receiverId) : null,
        senderRole,
        senderName,
        senderAvatar,
        message: messageDoc.message,
        isRead: false,
        createdAt: (messageDoc as any).createdAt,
      };

      // Broadcast to ride room
      this.socketService.emitToRide(String(ride._id), 'chat:message', messagePayload);
      this.socketService.emitToRide(String(ride._id), 'newMessage', messagePayload);

      // Emit to sender's user room
      this.socketService.emitToUser(String(userId), 'chat:message', messagePayload);
      this.socketService.emitToUser(String(userId), 'newMessage', messagePayload);

      if (receiverId) {
        this.socketService.emitToUser(String(receiverId), 'chat:message', messagePayload);
        this.socketService.emitToUser(String(receiverId), 'newMessage', messagePayload);
      }

      return new ApiResponse(200, messagePayload, 'Message sent successfully');
    } catch (error) {
      console.error('Error in ChatService.sendMessage:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Get message history for a ride
   */
  async getMessages(
    userId: string,
    rideId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    try {
      const access = await this.getRideAndVerifyAccess(userId, rideId);
      if (access.error) {
        return access.error;
      }

      const parsedPage = Math.max(1, Number(page) || 1);
      const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 50));

      const totalMessages = await this.chatMessageModel.countDocuments({
        $or: [{ rideId }, { ride: rideId }],
      });

      const messages = await this.chatMessageModel
        .find({
          $or: [{ rideId }, { ride: rideId }],
        })
        .sort({ createdAt: -1 })
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit)
        .lean();

      // Reverse so messages are chronological (oldest -> newest)
      const chronological = messages.reverse().map((msg: any) => ({
        _id: String(msg._id),
        rideId: msg.rideId || msg.ride,
        senderId: msg.senderId || msg.sender,
        receiverId: msg.receiverId || msg.receiver,
        senderRole: msg.senderRole || 'USER',
        senderName: msg.senderName || '',
        senderAvatar: msg.senderAvatar || null,
        message: msg.message,
        isRead: Boolean(msg.isRead),
        createdAt: msg.createdAt,
      }));

      // Automatically mark incoming messages as read
      await this.chatMessageModel.updateMany(
        {
          rideId,
          receiverId: String(userId),
          isRead: false,
        },
        { $set: { isRead: true } },
      );

      return new ApiResponse(
        200,
        {
          rideId,
          messages: chronological,
          pagination: {
            totalMessages,
            totalPages: Math.ceil(totalMessages / parsedLimit),
            currentPage: parsedPage,
            limit: parsedLimit,
          },
        },
        'Chat history fetched successfully',
      );
    } catch (error) {
      console.error('Error in ChatService.getMessages:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Mark all unread messages for this ride as read
   */
  async markAsRead(userId: string, rideId: string) {
    try {
      const access = await this.getRideAndVerifyAccess(userId, rideId);
      if (access.error) {
        return access.error;
      }

      await this.chatMessageModel.updateMany(
        {
          rideId,
          receiverId: String(userId),
          isRead: false,
        },
        { $set: { isRead: true } },
      );

      this.socketService.emitToRide(rideId, 'chat:read', {
        rideId,
        readBy: userId,
        readAt: new Date(),
      });

      return new ApiResponse(200, { rideId, readBy: userId }, 'Messages marked as read');
    } catch (error) {
      console.error('Error in ChatService.markAsRead:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Send typing indicator to ride room
   */
  async sendTypingIndicator(
    userId: string,
    roles: any,
    data: { rideId: string; isTyping: boolean },
  ) {
    try {
      if (!data?.rideId) return;

      const access = await this.getRideAndVerifyAccess(userId, data.rideId);
      if (access.error) return;

      this.socketService.emitToRide(data.rideId, 'chat:typing', {
        rideId: data.rideId,
        senderId: userId,
        senderRole: access.senderRole,
        isTyping: Boolean(data.isTyping),
      });
    } catch (error) {
      console.error('Error in sendTypingIndicator:', error);
    }
  }
}
