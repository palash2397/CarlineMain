import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class SocketService {
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  getServer() {
    return this.server;
  }

  emitToUser(userId: any, event: string, data: any) {
    if (!this.server) {
      console.log('Socket server not initialized');
      return;
    }

    const room = `user:${userId}`;

    console.log('socket room ---------->', room);
    console.log('socket event ---------->', event);

    const sockets = this.server.sockets.adapter.rooms.get(room);

    console.log('connected sockets in room ---------->', sockets?.size || 0);

    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToRide(rideId: string, event: string, data: any) {
    if (!this.server) return;

    this.server.to(`ride:${rideId}`).emit(event, data);
  }
}
