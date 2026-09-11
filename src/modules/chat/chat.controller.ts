import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from 'src/modules/auth/roles/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // @Get(':rideId/messages')
  // async getMessages(
  //   @Req() req: any,
  //   @Param('rideId') rideId: string,
  //   @Query('page') page: number = 1,
  //   @Query('limit') limit: number = 10,
  // ) {
  //   try {
  //     const messages = await this.chatService.getMessages(
  //       req.user.id,
  //       rideId,
  //       page,
  //       limit,
  //     );
  //     return new ApiResponse(200, messages, Msg.CHAT_FETCHED);
  //   } catch (error) {
  //     console.log(error);
  //     return new ApiResponse(500, {}, Msg.SERVER_ERROR);
  //   }
  // }
}
