import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
// import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

import { ChatService } from './chat.service';
import { JoinChatDto } from './dto/join-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';

@WebSocketGateway({
  path: '/viamo/socket.io',
  cors: {
    origin: '*',
  },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  // @SubscribeMessage('joinRideChat')
  // async joinRideChat(
  //   @ConnectedSocket() client: Socket,
  //   @MessageBody() dto: JoinChatDto,
  // ) {
  //   return this.chatService.joinRideChat(client, dto);
  // }

  // @SubscribeMessage('sendMessage')
  // async sendMessage(
  //   @ConnectedSocket() client: Socket,
  //   @MessageBody() dto: SendMessageDto,
  // ) {
  //   return this.chatService.sendMessage(client, dto, this.server);
  // }
}
