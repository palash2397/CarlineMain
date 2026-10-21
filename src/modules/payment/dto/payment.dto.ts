import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';

export class ChargeRideDto {
  @ApiProperty({ description: 'Ride ID to charge payment for' })
  @IsString()
  @IsNotEmpty()
  rideId: string;

  @ApiPropertyOptional({
    description: 'USAePay payment method key (saved card). If not provided, default card is used.',
  })
  @IsOptional()
  @IsString()
  payMethodKey?: string;

  @ApiPropertyOptional({
    description: 'Payment method: CARD or CASH. Defaults to ride paymentMethod.',
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class RefundTransactionDto {
  @ApiProperty({ description: 'Payment transaction ID to refund' })
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @ApiPropertyOptional({
    description: 'Partial refund amount in USD. Leave empty for full refund.',
    example: 5.00,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ description: 'Reason for refund' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PaymentQueryDto {
  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', example: 20 })
  @IsOptional()
  @IsNumber()
  limit?: number;
}
