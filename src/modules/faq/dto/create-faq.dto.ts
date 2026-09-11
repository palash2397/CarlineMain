import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateFaqDto {
  @ApiProperty({
    example: 'How do I request a ride?',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question: string;

  @ApiProperty({
    example: 'You can request a ride by opening the app and selecting your destination.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  answer: string;
}
