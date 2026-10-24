import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { App, initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getMessaging, Message } from 'firebase-admin/messaging';
import * as fs from 'fs';
import * as path from 'path';

import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';
import { SocketService } from '../socket/socket.service';
import { User, UserDocument } from '../user/schema/user.schema';
import { Driver, DriverDocument } from '../driver/schema/driver.schema';
import {
  Notification,
  NotificationDocument,
} from './schema/notification.schema';
import { Broadcast, BroadcastDocument, BroadcastTarget } from './schema/broadcast.schema';
import { Ride, RideDocument } from '../ride/schema/ride.schema';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { SendTestPushDto } from './dto/send-test-push.dto';
import { DispatcherSendNotificationDto, DispatcherTargetType } from './dto/dispatcher-send-notification.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { Types } from 'mongoose';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  type?: string;
}

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);
  private firebaseApp: App | null = null;

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(Broadcast.name)
    private readonly broadcastModel: Model<BroadcastDocument>,
    @InjectModel(Ride.name)
    private readonly rideModel: Model<RideDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,
    private readonly socketService: SocketService,
  ) {}

  onModuleInit() {
    this.initFirebase();
  }

  private initFirebase() {
    try {
      if (getApps().length > 0) {
        this.firebaseApp = getApp();
        this.logger.log('Firebase Admin already initialized.');
        return;
      }

      const credPath =
        process.env.FIREBASE_CREDENTIALS_PATH ||
        './src/config/firebase-service-account.json';
      const resolvedPath = path.isAbsolute(credPath)
        ? credPath
        : path.resolve(process.cwd(), credPath);

      if (fs.existsSync(resolvedPath)) {
        const fileContent = fs.readFileSync(resolvedPath, 'utf8');
        const serviceAccount = JSON.parse(fileContent);

        this.firebaseApp = initializeApp({
          credential: cert(serviceAccount),
        });

        this.logger.log(
          `Firebase initialized successfully with project: ${serviceAccount.project_id}`,
        );
      } else {
        this.logger.warn(
          `Firebase service account credentials not found at: ${resolvedPath}`,
        );
      }
    } catch (error: any) {
      this.logger.error('Failed to initialize Firebase Admin SDK:', error.message);
    }
  }

  isFirebaseReady(): boolean {
    return Boolean(this.firebaseApp);
  }

  /**
   * Save or update FCM device token for logged in user or driver
   */
  async updateFcmToken(userId: string, role: string, dto: UpdateFcmTokenDto) {
    try {
      const isDriver = role === 'DRIVER';
      const fcmToken = dto.fcmToken.trim();

      if (isDriver) {
        const driver = await this.driverModel.findByIdAndUpdate(
          userId,
          { $set: { fcmToken } },
          { new: true },
        );
        if (!driver) {
          return new ApiResponse(404, {}, 'Driver not found');
        }
      } else {
        const user = await this.userModel.findByIdAndUpdate(
          userId,
          { $set: { fcmToken } },
          { new: true },
        );
        if (!user) {
          return new ApiResponse(404, {}, Msg.USER_NOT_FOUND);
        }
      }

      return new ApiResponse(200, { fcmToken }, 'FCM token registered successfully');
    } catch (error: any) {
      this.logger.error('Error updating FCM token:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Send notification to a specific User or Driver.
   * 1. Stores persistent notification in DB
   * 2. Emits realtime socket event
   * 3. Dispatches FCM mobile push if recipient has registered FCM device token
   */
  async sendToUser(
    targetUserId: string,
    payload: PushNotificationPayload,
    targetType: 'USER' | 'DRIVER' | 'COMPANY_USER' = 'USER',
  ) {
    try {
      if (!targetUserId) return null;

      // 1. Persist notification in database
      const notificationDoc = await this.notificationModel.create({
        user: String(targetUserId),
        userType: targetType,
        title: payload.title,
        body: payload.body,
        type: payload.type || 'GENERAL',
        data: payload.data || {},
      });

      // 2. Realtime in-app socket emit
      try {
        this.socketService.emitToUser(
          targetUserId,
          'notification:new',
          notificationDoc.toObject ? notificationDoc.toObject() : notificationDoc,
        );
        // Realtime unread count update
        await this.emitUnreadCount(targetUserId);
      } catch (err: any) {
        this.logger.warn(`Failed to emit socket notification to ${targetUserId}: ${err.message}`);
      }

      // 3. Dispatch Firebase Push Notification
      if (this.firebaseApp) {
        let fcmToken: string | null = null;

        if (targetType === 'DRIVER') {
          if (Types.ObjectId.isValid(targetUserId)) {
            const driver = await this.driverModel.findById(targetUserId).select('fcmToken');
            fcmToken = driver?.fcmToken || null;
            if (!fcmToken) {
              const user = await this.userModel.findById(targetUserId).select('fcmToken');
              fcmToken = user?.fcmToken || null;
            }
          }
        } else {
          if (Types.ObjectId.isValid(targetUserId)) {
            const user = await this.userModel.findById(targetUserId).select('fcmToken');
            fcmToken = user?.fcmToken || null;
            if (!fcmToken) {
              const driver = await this.driverModel.findById(targetUserId).select('fcmToken');
              fcmToken = driver?.fcmToken || null;
            }
          }
        }

        if (fcmToken) {
          await this.sendFcmMessage(fcmToken, payload, targetUserId, targetType);
        } else {
          this.logger.debug(`No FCM token registered for ${targetType} ${targetUserId}`);
        }
      }

      return notificationDoc;
    } catch (error: any) {
      this.logger.error(`Error sending notification to ${targetUserId}:`, error);
      return null;
    }
  }

  /**
   * Dispatch raw FCM push message with graceful stale token handling
   */
  private async sendFcmMessage(
    fcmToken: string,
    payload: PushNotificationPayload,
    targetUserId?: string,
    targetType?: string,
  ) {
    try {
      // Stringify data dictionary values (FCM requirement: all data values must be strings)
      const sanitizedData: Record<string, string> = {};
      if (payload.data) {
        for (const [key, val] of Object.entries(payload.data)) {
          sanitizedData[key] = typeof val === 'string' ? val : JSON.stringify(val);
        }
      }
      sanitizedData.type = payload.type || 'GENERAL';

      if (!sanitizedData.sound) {
        sanitizedData.sound = 'default';
      }

      const androidNotification: any = {
        sound: 'default',
        defaultSound: true,
        defaultVibrateTimings: true,
        priority: 'high',
      };
      if (payload.data?.channelId && payload.data.channelId !== 'carline_rides') {
        androidNotification.channelId = payload.data.channelId;
      }

      const message: Message = {
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: sanitizedData,
        android: {
          priority: 'high',
          notification: androidNotification,
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              contentAvailable: true,
            },
          },
        },
      };

      const response = await getMessaging(this.firebaseApp || undefined).send(message);
      this.logger.log(`Successfully sent FCM push message: ${response}`);
      return response;
    } catch (fcmError: any) {
      this.logger.warn(`FCM send error for token ${fcmToken.slice(0, 15)}...: ${fcmError.message}`);

      // Clear dead/invalid token from database
      if (
        targetUserId &&
        (fcmError.code === 'messaging/registration-token-not-registered' ||
          fcmError.code === 'messaging/invalid-registration-token')
      ) {
        this.logger.log(`Cleaning up expired FCM token for ${targetType} ${targetUserId}`);
        if (targetType === 'DRIVER') {
          await this.driverModel.findByIdAndUpdate(targetUserId, { $unset: { fcmToken: 1 } });
        } else {
          await this.userModel.findByIdAndUpdate(targetUserId, { $unset: { fcmToken: 1 } });
        }
      }
      return null;
    }
  }

  /**
   * Broadcast topic notification (e.g. 'drivers' or 'passengers')
   */
  async sendToTopic(topic: string, payload: PushNotificationPayload) {
    try {
      if (!this.firebaseApp) return null;

      const sanitizedData: Record<string, string> = {};
      if (payload.data) {
        for (const [key, val] of Object.entries(payload.data)) {
          sanitizedData[key] = typeof val === 'string' ? val : JSON.stringify(val);
        }
      }

      const message: Message = {
        topic,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: sanitizedData,
      };

      return await getMessaging(this.firebaseApp || undefined).send(message);
    } catch (error: any) {
      this.logger.error(`Error sending topic notification to ${topic}:`, error);
      return null;
    }
  }

  /**
   * Get user's notifications history
   */
  async getMyNotifications(userId: string, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      const [notifications, total] = await Promise.all([
        this.notificationModel
          .find({ user: userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        this.notificationModel.countDocuments({ user: userId }),
      ]);

      const unreadCount = await this.notificationModel.countDocuments({
        user: userId,
        isRead: false,
      });

      return new ApiResponse(
        200,
        {
          notifications,
          unreadCount,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
        'Notifications fetched successfully',
      );
    } catch (error: any) {
      this.logger.error('Error fetching notifications:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Recalculate and emit real-time unread notification count via socket to a user
   */
  async emitUnreadCount(userId: string): Promise<number> {
    try {
      if (!userId) return 0;
      const unreadCount = await this.notificationModel.countDocuments({
        user: String(userId),
        isRead: false,
      });

      this.socketService.emitToUser(String(userId), 'notification:count', {
        unreadCount,
      });

      return unreadCount;
    } catch (err: any) {
      this.logger.warn(`Failed to emit notification:count to ${userId}: ${err.message}`);
      return 0;
    }
  }

  /**
   * Unread notifications count
   */
  async getUnreadCount(userId: string) {
    try {
      const unreadCount = await this.notificationModel.countDocuments({
        user: userId,
        isRead: false,
      });
      return new ApiResponse(200, { unreadCount }, 'Unread count fetched');
    } catch (error: any) {
      this.logger.error('Error fetching unread count:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Mark single notification as read
   */
  async markAsRead(userId: string, notificationId: string) {
    try {
      const notification = await this.notificationModel.findOneAndUpdate(
        { _id: notificationId, user: userId },
        { $set: { isRead: true, readAt: new Date() } },
        { new: true },
      );

      if (!notification) {
        return new ApiResponse(404, {}, 'Notification not found');
      }

      // Realtime socket count update
      const unreadCount = await this.emitUnreadCount(userId);

      return new ApiResponse(200, { notification, unreadCount }, 'Notification marked as read');
    } catch (error: any) {
      this.logger.error('Error marking notification as read:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Mark all notifications as read for current user
   */
  async markAllAsRead(userId: string) {
    try {
      await this.notificationModel.updateMany(
        { user: userId, isRead: false },
        { $set: { isRead: true, readAt: new Date() } },
      );

      // Realtime socket count update (all are read, count = 0)
      this.socketService.emitToUser(String(userId), 'notification:count', {
        unreadCount: 0,
      });

      return new ApiResponse(200, { unreadCount: 0 }, 'All notifications marked as read');
    } catch (error: any) {
      this.logger.error('Error marking all notifications as read:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification(currentUserId: string, currentUserRole: string, dto: SendTestPushDto) {
    try {
      const targetId = dto.targetId || currentUserId;
      const targetType = currentUserRole === 'DRIVER' ? 'DRIVER' : 'USER';

      const res = await this.sendToUser(
        targetId,
        {
          title: dto.title,
          body: dto.body,
          data: dto.data || {},
          type: 'TEST_PUSH',
        },
        targetType,
      );

      return new ApiResponse(
        200,
        {
          targetId,
          firebaseInitialized: this.isFirebaseReady(),
          notification: res,
        },
        'Test notification processed successfully',
      );
    } catch (error: any) {
      this.logger.error('Error in sendTestNotification:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Dispatcher sends manual notification/alert to driver or rider of a trip
   */
  async dispatcherSendNotification(senderUser: any, dto: DispatcherSendNotificationDto) {
    try {
      let targetId = dto.targetId;

      // If rideId is provided and targetId is not specified, resolve from ride
      if (dto.rideId && !targetId) {
        if (!Types.ObjectId.isValid(dto.rideId)) {
          return new ApiResponse(400, {}, 'Invalid rideId provided');
        }
        const ride = await this.rideModel.findById(dto.rideId);
        if (!ride) {
          return new ApiResponse(404, {}, 'Ride not found');
        }
        if (dto.targetType === DispatcherTargetType.DRIVER) {
          targetId = ride.driver ? String(ride.driver) : ride.candidateDriverId ? String(ride.candidateDriverId) : undefined;
        } else {
          targetId = ride.user ? String(ride.user) : undefined;
        }
      }

      if (!targetId || !Types.ObjectId.isValid(targetId)) {
        return new ApiResponse(400, {}, 'Valid targetId or rideId with assigned recipient is required');
      }

      const notifData = {
        ...(dto.data || {}),
        rideId: dto.rideId || '',
        sentBy: 'DISPATCHER',
        dispatcherId: senderUser?.id || '',
        type: 'DISPATCHER_MESSAGE',
      };

      const result = await this.sendToUser(
        targetId,
        {
          title: dto.title,
          body: dto.body,
          data: notifData,
          type: 'DISPATCHER_MESSAGE',
        },
        dto.targetType,
      );

      // If ride exists, also notify the ride room
      if (dto.rideId) {
        this.socketService.emitToRide(dto.rideId, 'notification:new', {
          title: dto.title,
          body: dto.body,
          type: 'DISPATCHER_MESSAGE',
          data: notifData,
        });
      }

      return new ApiResponse(
        200,
        {
          targetId,
          targetType: dto.targetType,
          rideId: dto.rideId,
          notification: result,
        },
        'Dispatcher notification sent successfully',
      );
    } catch (error: any) {
      this.logger.error('Error in dispatcherSendNotification:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Broadcast push notification & in-app announcement to all Drivers, all Users, or All
   */
  async broadcastNotification(senderUser: any, dto: BroadcastNotificationDto) {
    try {
      const { target, title, body, companyId, data } = dto;
      const targetDrivers = target === BroadcastTarget.DRIVERS || target === BroadcastTarget.ALL;
      const targetUsers = target === BroadcastTarget.USERS || target === BroadcastTarget.ALL;

      const recipientUserIds: Array<{ id: string; type: 'USER' | 'DRIVER' }> = [];
      const fcmTokens: string[] = [];

      // 1. Fetch Drivers if targeted
      if (targetDrivers) {
        const driverFilter: any = {};
        if (companyId && Types.ObjectId.isValid(companyId)) {
          driverFilter.companyId = companyId;
        }
        const drivers = await this.driverModel.find(driverFilter, { _id: 1, fcmToken: 1 });
        drivers.forEach((d) => {
          recipientUserIds.push({ id: String(d._id), type: 'DRIVER' });
          if (d.fcmToken && d.fcmToken.trim().length > 10) {
            fcmTokens.push(d.fcmToken.trim());
          }
        });
      }

      // 2. Fetch Users if targeted
      if (targetUsers) {
        const userFilter: any = {};
        if (companyId && Types.ObjectId.isValid(companyId)) {
          userFilter.companyId = companyId;
        }
        const users = await this.userModel.find(userFilter, { _id: 1, fcmToken: 1 });
        users.forEach((u) => {
          recipientUserIds.push({ id: String(u._id), type: 'USER' });
          if (u.fcmToken && u.fcmToken.trim().length > 10) {
            fcmTokens.push(u.fcmToken.trim());
          }
        });
      }

      // 3. Batch FCM Push notifications (up to 500 per batch)
      let successCount = 0;
      let failureCount = 0;
      const uniqueTokens = Array.from(new Set(fcmTokens));

      if (uniqueTokens.length > 0 && this.firebaseApp) {
        const sanitizedData: Record<string, string> = {
          type: 'BROADCAST',
          sentAt: new Date().toISOString(),
        };
        if (data) {
          for (const [k, v] of Object.entries(data)) {
            sanitizedData[k] = typeof v === 'string' ? v : JSON.stringify(v);
          }
        }

        const BATCH_SIZE = 500;
        for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
          const batch = uniqueTokens.slice(i, i + BATCH_SIZE);
          try {
            const batchResponse = await getMessaging(this.firebaseApp).sendEachForMulticast({
              tokens: batch,
              notification: { title, body },
              data: sanitizedData,
              android: {
                priority: 'high',
                notification: {
                  sound: 'default',
                  defaultSound: true,
                  defaultVibrateTimings: true,
                  priority: 'high',
                },
              },
              apns: {
                payload: { aps: { sound: 'default', badge: 1, contentAvailable: true } },
              },
            });
            successCount += batchResponse.successCount;
            failureCount += batchResponse.failureCount;
          } catch (batchErr: any) {
            this.logger.error(`Error sending FCM multicast batch: ${batchErr.message}`);
            failureCount += batch.length;
          }
        }
      }

      // 4. In-App Notifications: Bulk insert into MongoDB
      if (recipientUserIds.length > 0) {
        const inAppDocs = recipientUserIds.map((r) => ({
          user: new Types.ObjectId(r.id),
          userType: r.type,
          title,
          body,
          type: 'BROADCAST',
          data: data || {},
          isRead: false,
          readAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        // Insert in batches of 1000
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < inAppDocs.length; i += CHUNK_SIZE) {
          await this.notificationModel.insertMany(inAppDocs.slice(i, i + CHUNK_SIZE), { ordered: false }).catch(() => {});
        }
      }

      // 5. Emit Real-time Socket Event to drivers & users
      const socketPayload = {
        title,
        body,
        type: 'BROADCAST',
        data: data || {},
        createdAt: new Date(),
      };
      if (targetDrivers) {
        this.socketService.emitToRoom('drivers', 'notification:new', socketPayload);
      }
      recipientUserIds.slice(0, 100).forEach((r) => {
        this.socketService.emitToUser(r.id, 'notification:new', socketPayload);
      });

      // 6. Record in Broadcast history collection
      const broadcastRecord = await this.broadcastModel.create({
        title,
        body,
        target,
        companyId: companyId || null,
        senderId: senderUser?.id || null,
        senderRole: senderUser?.roles || null,
        data: data || {},
        totalRecipients: recipientUserIds.length,
        successCount,
        failureCount,
      });

      return new ApiResponse(
        200,
        {
          broadcastId: broadcastRecord._id,
          target,
          totalRecipients: recipientUserIds.length,
          fcmTokensReached: uniqueTokens.length,
          successCount,
          failureCount,
        },
        'Broadcast notification dispatched successfully',
      );
    } catch (error: any) {
      this.logger.error('Error in broadcastNotification:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Get past broadcast history for Admin / Dispatcher
   */
  async getBroadcastHistory(page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      const [broadcasts, total] = await Promise.all([
        this.broadcastModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
        this.broadcastModel.countDocuments(),
      ]);

      return new ApiResponse(
        200,
        {
          broadcasts,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        'Broadcast history fetched successfully',
      );
    } catch (error: any) {
      this.logger.error('Error in getBroadcastHistory:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }
}
