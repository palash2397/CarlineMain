import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Length,
  Matches,
  IsBoolean,
} from 'class-validator';

export class AddCardDto {
  @ApiProperty({ description: 'Card number (no spaces)', example: '4111111111111111' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{13,19}$/, { message: 'Invalid card number' })
  cardNumber: string;

  @ApiProperty({ description: 'Card expiration in MMYY format', example: '1226' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}$/, { message: 'Expiration must be MMYY format (4 digits)' })
  cardExpiration: string;

  @ApiPropertyOptional({ description: 'CVV/CVC code', example: '123' })
  @IsOptional()
  @IsString()
  @Length(3, 4)
  cardCode?: string;

  @ApiPropertyOptional({ description: 'Cardholder full name', example: 'John Doe' })
  @IsOptional()
  @IsString()
  billingName?: string;

  @ApiPropertyOptional({ description: 'Billing address' })
  @IsOptional()
  @IsString()
  billingAddress?: string;

  @ApiPropertyOptional({ description: 'Billing city' })
  @IsOptional()
  @IsString()
  billingCity?: string;

  @ApiPropertyOptional({ description: 'Billing state (2-letter code)', example: 'NY' })
  @IsOptional()
  @IsString()
  billingState?: string;

  @ApiPropertyOptional({ description: 'Billing zip code', example: '10001' })
  @IsOptional()
  @IsString()
  billingZip?: string;

  @ApiPropertyOptional({ description: 'Billing country (ISO 2-letter)', example: 'US' })
  @IsOptional()
  @IsString()
  billingCountry?: string;
}
