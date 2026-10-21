import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CommissionType } from '../enums/commission/commission-type.enum';

export class CommissionConfigDto {
  @ApiProperty({
    enum: CommissionType,
    example: CommissionType.PERCENTAGE,
    description: 'Commission calculation type (PERCENTAGE or FLAT)',
  })
  @IsEnum(CommissionType)
  type: CommissionType;

  @ApiProperty({
    type: Number,
    example: 10,
    description: 'Commission value (e.g. 10 for 10% or 2 for $2 flat)',
  })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional({
    type: Boolean,
    example: true,
    description: 'Whether this commission rule is currently active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean = true;
}

export class UpdateCompanyCommissionDto {
  @ApiPropertyOptional({
    type: CommissionConfigDto,
    description: 'Commission charged by Superadmin to this Company',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CommissionConfigDto)
  superAdminCommission?: CommissionConfigDto;

  @ApiPropertyOptional({
    type: CommissionConfigDto,
    description: 'Default commission charged by this Company to its Drivers',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CommissionConfigDto)
  defaultDriverCommission?: CommissionConfigDto;
}

export class UpdateDriverCommissionDto extends CommissionConfigDto {}
