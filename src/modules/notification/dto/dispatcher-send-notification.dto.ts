import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum DispatcherTargetType {
  DRIVER = 'DRIVER',
  USER = 'USER',
}

export class DispatcherSendNotificationDto {
  @ApiProperty({
    enum: DispatcherTargetType,
    example: DispatcherTargetType.DRIVER,
    description: 'Target recipient type: DRIVER or USER',
  })
  @IsEnum(DispatcherTargetType)
  @IsNotEmpty()
  targetType: DispatcherTargetType;

  @ApiPropertyOptional({
    description: 'Target Driver ID or User ID (required if rideId is not provided)',
    example: '6aa8e3a259dc9fc0913ababe',
  })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({
    description: 'Ride ID to automatically target the assigned driver or passenger of that ride',
    example: '6acce08c76baad27250d94c0',
  })
  @IsOptional()
  @IsString()
  rideId?: string;

  @ApiProperty({
    description: 'Notification title',
    example: 'Trip Update from Dispatcher',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Notification message body',
    example: 'Please proceed to pickup gate 2 immediately.',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({
    description: 'Optional custom key-value data payload',
    example: { priority: 'urgent', action: 'GATE_CHANGE' },
  })
  @IsOptional()
  data?: Record<string, any>;
}
