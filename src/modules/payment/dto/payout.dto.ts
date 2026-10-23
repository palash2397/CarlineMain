import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayoutStatus } from 'src/common/enums/payment/payout-status.enum';

export class BankDetailsDto {
  @ApiProperty({ description: 'Bank account number', example: '1234567890' })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({ description: 'Routing number or IFSC code', example: '021000021' })
  @IsString()
  @IsNotEmpty()
  routingNumber: string;

  @ApiProperty({ description: 'Bank name', example: 'Chase Bank' })
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({ description: 'Account holder full name', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  accountHolderName: string;
}

export class CreatePayoutRequestDto {
  @ApiProperty({ description: 'Amount to withdraw (in driver currency)', example: 150 })
  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ description: 'Driver bank account details for transfer', type: BankDetailsDto })
  @ValidateNested()
  @Type(() => BankDetailsDto)
  @IsNotEmpty()
  bankDetails: BankDetailsDto;

  @ApiPropertyOptional({ description: 'Optional driver note for request', example: 'Weekly withdrawal' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApprovePayoutDto {
  @ApiPropertyOptional({ description: 'Bank transfer / reference ID', example: 'WIRE-9928341' })
  @IsOptional()
  @IsString()
  transferReference?: string;

  @ApiPropertyOptional({ description: 'Optional approval notes', example: 'Processed via ACH transfer' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectPayoutDto {
  @ApiProperty({ description: 'Reason for rejecting payout', example: 'Invalid bank account number' })
  @IsString()
  @IsNotEmpty()
  rejectionReason: string;
}

export class GetPayoutsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by payout status', enum: PayoutStatus })
  @IsOptional()
  @IsEnum(PayoutStatus)
  status?: PayoutStatus;

  @ApiPropertyOptional({ description: 'Page number', example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page limit', example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;
}
