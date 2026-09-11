import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSupportDto {
  @ApiProperty({
    example: 'I left my wallet in the car on my last ride.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;
}
