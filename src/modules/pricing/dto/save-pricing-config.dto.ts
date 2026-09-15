import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { UpdateFareRulesDto } from './update-fare-rules.dto';
import { CreateZoneRuleDto } from './create-zone-rule.dto';
import { UpdateWaitingChargesDto } from './update-waiting-charges.dto';

export class SavePricingConfigDto {
  @ApiPropertyOptional({ type: () => UpdateFareRulesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateFareRulesDto)
  fareRules?: UpdateFareRulesDto;

  @ApiPropertyOptional({ type: () => [CreateZoneRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateZoneRuleDto)
  zonePricing?: CreateZoneRuleDto[];

  @ApiPropertyOptional({ type: () => UpdateWaitingChargesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateWaitingChargesDto)
  waitingCharges?: UpdateWaitingChargesDto;

  @ApiPropertyOptional({
    example: '66e6be12e4b0c2a5d3f88999',
    description: 'Company ID (optional, SuperAdmin can specify)',
  })
  @IsOptional()
  @IsString()
  companyId?: string;
}
