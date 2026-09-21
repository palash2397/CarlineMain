import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

import { DRIVER_ROOM, driverRoomFor } from 'src/constants';

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

  // Online drivers listen in the shared drivers room and in the room of their
  // own vehicle type. With a vehicleTypeId the event only reaches the drivers
  // who can actually accept that ride.
  emitToDrivers(event: string, data: any, vehicleTypeId?: string) {
    if (!this.server) return;

    const room = vehicleTypeId ? driverRoomFor(vehicleTypeId) : DRIVER_ROOM;

    this.server.to(room).emit(event, data);
  }

  // Ride room + personal room of one actor in a single emit. Socket.IO unions
  // the rooms, so a socket sitting in both rooms still gets the event once.
  emitToRideAndActor(actorId: any, rideId: string, event: string, data: any) {
    if (!this.server || !actorId) return;

    this.server.to(`ride:${rideId}`).to(`user:${actorId}`).emit(event, data);
  }

  // Puts every open socket of one actor (passenger or driver) inside the room
  // of a ride, so status and location events reach the app right away.
  joinActorToRide(actorId: any, rideId: string) {
    if (!this.server) return;

    this.server.in(`user:${actorId}`).socketsJoin(`ride:${rideId}`);
  }

  leaveRideRoom(rideId: string) {
    if (!this.server) return;

    this.server.in(`ride:${rideId}`).socketsLeave(`ride:${rideId}`);
  }
}
