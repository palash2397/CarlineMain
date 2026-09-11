import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

export class JoinChatDto {
  @ApiProperty()
  @IsMongoId()
  rideId: string;
}
