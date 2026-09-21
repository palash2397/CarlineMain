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
import { RideService } from '../ride/ride.service';
import { DriverRideService } from '../ride/driver-ride.service';
import { DriverLocationDto } from '../ride/dto/driver-location.dto';
import { DRIVER_ROOM } from '../ride/ride.constants';

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
    @Inject(forwardRef(() => RideService))
    private readonly rideService: RideService,
    @Inject(forwardRef(() => DriverRideService))
    private readonly driverRideService: DriverRideService,
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

    // Drivers also join a shared room so new ride requests can be pushed.
    const roles = Array.isArray(user.roles) ? user.roles : [user.roles];

    if (roles.includes('DRIVER')) {
      // Shared driver pool + the room of his own vehicle type, so a driver only
      // gets the requests he can accept.
      const driverRooms = await this.driverRideService.socketRoomsForDriver(
        user.id,
      );

      for (const driverRoom of driverRooms) {
        await client.join(driverRoom);
      }

      // A driver with a running ride lands in that ride room so passenger
      // cancels and status changes reach the app right away.
      const driverRideId = await this.driverRideService.activeRideIdForDriver(
        user.id,
      );

      if (driverRideId) {
        await client.join('ride:' + driverRideId);
      }
    }

    // A passenger with a running ride joins that ride room right away so live
    // driver location and status events always reach the app.
    if (roles.includes('USER') || roles.includes('PASSENGER')) {
      const rideId = await this.rideService.activeRideIdForUser(user.id);

      if (rideId) {
        await client.join('ride:' + rideId);
      }
    }

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

  // Live location pushed by the driver app. The passenger app receives it as
  // the ride:driverLocation event with the updated ETA.
  @SubscribeMessage('driverLocation')
  async driverLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: DriverLocationDto,
  ) {
    const user = client.data.user;
    const roles = Array.isArray(user?.roles) ? user.roles : [user?.roles];

    if (!user?.id || !roles.includes('DRIVER')) {
      return {
        success: false,
        message: 'Only a driver can update the location',
      };
    }

    if (
      typeof data?.latitude !== 'number' ||
      typeof data?.longitude !== 'number'
    ) {
      return { success: false, message: 'latitude and longitude are required' };
    }

    return this.rideService.updateDriverLocation(user.id, data);
  }
}
