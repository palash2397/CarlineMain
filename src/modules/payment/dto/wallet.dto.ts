import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from 'src/common/enums/ride/payment-method.enum';

export class TopUpWalletDto {
  @ApiProperty({
    example: 50,
    description: 'Amount in USD to recharge the passenger wallet',
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  @Type(() => Number)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    example: 'pm_12345abcdef',
    description: 'USAePay payment method key of the saved card to charge',
  })
  @IsString()
  @IsNotEmpty()
  payMethodKey: string;

  @ApiPropertyOptional({
    example: 'Wallet balance top-up',
    description: 'Optional note or reference for the top-up transaction',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class PayRideWithWalletDto {
  @ApiProperty({
    example: '6adaeedc6ca7f27a6b7748e8',
    description: 'Ride ID to pay from passenger wallet',
  })
  @IsString()
  @IsNotEmpty()
  rideId: string;

  @ApiPropertyOptional({
    enum: [PaymentMethod.CASH, PaymentMethod.CARD],
    default: PaymentMethod.CASH,
    description:
      'Payment method for any remaining balance if wallet balance is less than total fare (e.g. CASH or CARD)',
  })
  @IsEnum(PaymentMethod)
  @IsOptional()
  remainingPaymentMethod?: PaymentMethod = PaymentMethod.CASH;

  @ApiPropertyOptional({
    example: 'pm_12345abcdef',
    description:
      'USAePay saved card key if remaining balance should be charged immediately to card',
  })
  @IsString()
  @IsOptional()
  payMethodKey?: string;
}

export class WalletHistoryQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
