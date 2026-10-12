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
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { SendTestPushDto } from './dto/send-test-push.dto';

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
      } catch (err: any) {
        this.logger.warn(`Failed to emit socket notification to ${targetUserId}: ${err.message}`);
      }

      // 3. Dispatch Firebase Push Notification
      if (this.firebaseApp) {
        let fcmToken: string | null = null;

        if (targetType === 'DRIVER') {
          const driver = await this.driverModel.findById(targetUserId).select('fcmToken');
          fcmToken = driver?.fcmToken || null;
        } else {
          const user = await this.userModel.findById(targetUserId).select('fcmToken');
          fcmToken = user?.fcmToken || null;
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

      const message: Message = {
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: sanitizedData,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'carline_rides',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
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

      return new ApiResponse(200, notification, 'Notification marked as read');
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

      return new ApiResponse(200, {}, 'All notifications marked as read');
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
}
