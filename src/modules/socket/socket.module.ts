import { Global, Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';

import { User, UserSchema } from '../user/schema/user.schema';
import { RideModule } from '../ride/ride.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationModule } from '../notification/notification.module';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
    ]),
    RideModule,
    forwardRef(() => ChatModule),
    forwardRef(() => NotificationModule),
  ],
  providers: [SocketGateway, SocketService],
  exports: [SocketService],
})
export class SocketModule {}
