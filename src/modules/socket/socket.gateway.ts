import { forwardRef, Inject } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

import { SocketService } from './socket.service';

@WebSocketGateway({
  path: '/viamo/socket.io',
  cors: {
    origin: '*',
  },
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly socketService: SocketService,
  ) {}

  afterInit(server: Server) {
    this.socketService.setServer(server);

    server.use((socket: Socket, next) => {
      try {
        const token = socket.handshake.auth?.token;

        if (!token) {
          return next(new Error('Token not found'));
        }

        const payload = this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET,
        });

        socket.data.user = payload;

        next();
      } catch (error) {
        next(new Error('Invalid or expired token'));
      }
    });
  }

  async handleConnection(client: Socket) {
    const user = client.data.user;

    if (!user?.id) {
      client.disconnect();
      return;
    }

    const room = `user:${user.id}`;

    await client.join(room);

    // console.log('Socket connected ---------->', client.id);
    // console.log('User ID ---------->', user.id);
    // console.log('Joined room ---------->', room);

    console.log(`Socket connected: ${user.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRide')
  async joinRide(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      rideId: string;
    },
  ) {
    await client.join(`ride:${data.rideId}`);

    return {
      success: true,
      message: 'Ride joined successfully',
    };
  }

  // @SubscribeMessage('driverLocation')
  // async driverLocation(
  //   @ConnectedSocket() client: Socket,
  //   @MessageBody() data: UpdateDriverLocationDto,
  // ) {
  //   console.log('driverLocation event received');
  //   console.log('user:', client.data.user);
  //   console.log('location data:', data);

  //   const userId = client.data.user.id;

  //   const result = await this.driverService.updateDriverLocation(userId, data);

  //   console.log('location update result:', result);

  //   return result;
  // }
}
