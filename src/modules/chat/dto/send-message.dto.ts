import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsString } from 'class-validator';
// import { MessageType } from 'src/common/enums/chat/messageType';

export class SendMessageDto {
  @ApiProperty()
  @IsMongoId()
  rideId: string;

  @ApiProperty()
  @IsString()
  message: string;

  // @ApiProperty({
  //   enum: MessageType,
  //   required: false,
  //   default: MessageType.TEXT,
  // })
  // @IsEnum(MessageType)
  // messageType: MessageType = MessageType.TEXT;
}
