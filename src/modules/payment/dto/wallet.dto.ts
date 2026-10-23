import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from 'src/common/enums/ride/payment-method.enum';

export class DirectCardDto {
  @ApiProperty({ example: '4111111111111111', description: 'Credit card number' })
  @IsString()
  @IsNotEmpty()
  cardNumber: string;

  @ApiProperty({ example: '1228', description: 'Card expiration in MMYY format' })
  @IsString()
  @IsNotEmpty()
  cardExpiration: string;

  @ApiPropertyOptional({ example: '123', description: 'Card CVV / security code' })
  @IsString()
  @IsOptional()
  cardCode?: string;

  @ApiPropertyOptional({ example: 'John Doe', description: 'Cardholder name' })
  @IsString()
  @IsOptional()
  billingName?: string;

  @ApiPropertyOptional({ example: '123 Main St', description: 'Billing address' })
  @IsString()
  @IsOptional()
  billingAddress?: string;

  @ApiPropertyOptional({ example: 'New York', description: 'Billing city' })
  @IsString()
  @IsOptional()
  billingCity?: string;

  @ApiPropertyOptional({ example: 'NY', description: 'Billing state' })
  @IsString()
  @IsOptional()
  billingState?: string;

  @ApiPropertyOptional({ example: '10001', description: 'Billing postal / zip code' })
  @IsString()
  @IsOptional()
  billingZip?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether to save this card to customer vault for future rides/top-ups',
  })
  @IsBoolean()
  @IsOptional()
  saveCard?: boolean;
}

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

  @ApiPropertyOptional({
    example: 'pm_12345abcdef',
    description:
      'USAePay payment method key of the saved card to charge (optional if using card object or default saved card)',
  })
  @IsString()
  @IsOptional()
  payMethodKey?: string;

  @ApiPropertyOptional({
    type: DirectCardDto,
    description:
      'Direct card details if user does not have a saved card or wants to recharge with a new card directly',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DirectCardDto)
  card?: DirectCardDto;

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
