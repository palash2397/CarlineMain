import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendTestPushDto {
  @ApiPropertyOptional({
    example: '66fb1000ab083c261e1b1900',
    description: 'Target User or Driver ID (defaults to current logged-in user if omitted)',
  })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiProperty({
    example: 'Test Push Notification',
    description: 'Push notification title',
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    example: 'Hello! Firebase Cloud Messaging push notification is working perfectly on Carline.',
    description: 'Push notification body',
  })
  @IsNotEmpty()
  @IsString()
  body: string;

  @ApiPropertyOptional({
    example: { type: 'TEST', customKey: 'sampleValue' },
    description: 'Optional payload data object',
  })
  @IsOptional()
  data?: Record<string, any>;
}
