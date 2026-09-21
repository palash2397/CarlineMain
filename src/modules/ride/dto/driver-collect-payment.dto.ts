import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsOptional } from 'class-validator';

import { PaymentMethod } from 'src/common/enums/ride/payment-method.enum';

export class DriverCollectPaymentDto {
  @ApiProperty({ example: '6ab21f1f0fc5ffbd2fbe6401' })
  @IsMongoId()
  rideId: string;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    description: 'Payment actually collected (defaults to the booked method)',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}