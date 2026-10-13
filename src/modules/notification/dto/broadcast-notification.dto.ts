import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BroadcastTarget } from '../schema/broadcast.schema';

export class BroadcastNotificationDto {
  @ApiProperty({
    enum: BroadcastTarget,
    example: BroadcastTarget.DRIVERS,
    description: 'Broadcast target audience: DRIVERS, USERS, or ALL',
  })
  @IsEnum(BroadcastTarget)
  @IsNotEmpty()
  target: BroadcastTarget;

  @ApiProperty({
    description: 'Notification title',
    example: 'Special Weekend Incentive!',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Notification message body',
    example: 'Earn 20% extra bonus on every ride completed this Saturday and Sunday.',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({
    description: 'Filter broadcast by specific Company ID (optional)',
    example: '6aa904a815f2afcc842ee858',
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Optional custom key-value data payload',
    example: { promoType: 'WEEKEND_BONUS' },
  })
  @IsOptional()
  data?: Record<string, any>;
}
