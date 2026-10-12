import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateFcmTokenDto {
  @ApiProperty({
    example: 'f8d9a-c4e1b-fcm-device-registration-token-string',
    description: 'Firebase Cloud Messaging (FCM) device registration token',
  })
  @IsNotEmpty()
  @IsString()
  fcmToken: string;
}
