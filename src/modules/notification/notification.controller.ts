import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { NotificationService } from './notification.service';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { SendTestPushDto } from './dto/send-test-push.dto';

@ApiTags('Notifications (by Prakash)')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('/fcm-token')
  @ApiOperation({
    summary: 'Register or update FCM device token for mobile push notifications',
    description:
      'Saves the Firebase Cloud Messaging device token for the currently authenticated User or Driver.',
  })
  updateFcmToken(@Req() req: any, @Body() dto: UpdateFcmTokenDto) {
    const role = Array.isArray(req.user.roles) ? req.user.roles[0] : req.user.roles;
    return this.notificationService.updateFcmToken(req.user.id, role, dto);
  }

  @Get('/my')
  @ApiOperation({
    summary: 'Get in-app notifications history for logged in user or driver',
    description:
      'Returns paginated list of notifications with unread count and read status.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  getMyNotifications(
    @Req() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notificationService.getMyNotifications(
      req.user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('/unread-count')
  @ApiOperation({
    summary: 'Get count of unread notifications for bell badge',
  })
  getUnreadCount(@Req() req: any) {
    return this.notificationService.getUnreadCount(req.user.id);
  }

  @Patch('/:id/read')
  @ApiOperation({
    summary: 'Mark a single notification as read',
  })
  @ApiParam({ name: 'id', example: '66fb2475ab083c261e1b19a1' })
  markAsRead(@Req() req: any, @Param('id') id: string) {
    return this.notificationService.markAsRead(req.user.id, id);
  }

  @Patch('/read-all')
  @ApiOperation({
    summary: 'Mark all notifications as read for current user',
  })
  markAllAsRead(@Req() req: any) {
    return this.notificationService.markAllAsRead(req.user.id);
  }

  @Post('/test-push')
  @ApiOperation({
    summary: 'Send a test push & in-app notification',
    description:
      'Dispatches test notification to verify Firebase Cloud Messaging delivery and in-app socket push.',
  })
  sendTestPush(@Req() req: any, @Body() dto: SendTestPushDto) {
    const role = Array.isArray(req.user.roles) ? req.user.roles[0] : req.user.roles;
    return this.notificationService.sendTestNotification(req.user.id, role, dto);
  }
}
