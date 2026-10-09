import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';

@ApiTags('In-Ride Chat')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send an in-ride chat message (Passenger or Driver)' })
  async sendMessage(@Req() req: any, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(req.user.id, req.user.roles, dto);
  }

  @Get(':rideId/messages')
  @ApiOperation({ summary: 'Get chat history for an active/past ride' })
  @ApiParam({ name: 'rideId', description: 'ID of the ride' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  async getMessages(
    @Req() req: any,
    @Param('rideId') rideId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return this.chatService.getMessages(req.user.id, rideId, page, limit);
  }

  @Patch(':rideId/read')
  @ApiOperation({ summary: 'Mark all unread messages for this ride as read' })
  @ApiParam({ name: 'rideId', description: 'ID of the ride' })
  async markAsRead(@Req() req: any, @Param('rideId') rideId: string) {
    return this.chatService.markAsRead(req.user.id, rideId);
  }
}
