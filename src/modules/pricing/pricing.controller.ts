import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole, COMPANY_STAFF_ROLES } from 'src/common/enums/user/role.enum';
import { UpdateFareRulesDto } from './dto/update-fare-rules.dto';
import { CreateZoneRuleDto } from './dto/create-zone-rule.dto';
import { UpdateZoneRuleDto } from './dto/update-zone-rule.dto';
import { DeleteZoneRuleDto } from './dto/delete-zone-rule.dto';
import { UpdateWaitingChargesDto } from './dto/update-waiting-charges.dto';

@ApiTags('Pricing Engine')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(
  UserRole.COMPANY_ADMIN,
  ...COMPANY_STAFF_ROLES,
  UserRole.ADMIN,
  UserRole.SUPERADMIN,
)
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  // ==========================================
  // Overall Pricing Configuration (All-in-one)
  // ==========================================
  @Get()
  @ApiQuery({ name: 'companyId', required: false })
  async getPricingConfig(
    @Req() req: any,
    @Query('companyId') companyId?: string,
  ) {
    return this.pricingService.getPricingConfig(req.user, companyId);
  }

  // ==========================================
  // Tab 1: Fare Rules
  // ==========================================
  @Get('/fare-rules')
  @ApiQuery({ name: 'companyId', required: false })
  async getFareRules(@Req() req: any, @Query('companyId') companyId?: string) {
    return this.pricingService.getFareRules(req.user, companyId);
  }

  @Post('/fare-rules')
  async saveFareRulesPost(@Body() dto: UpdateFareRulesDto, @Req() req: any) {
    return this.pricingService.updateFareRules(dto, req.user);
  }

  @Put('/fare-rules')
  async updateFareRulesPut(@Body() dto: UpdateFareRulesDto, @Req() req: any) {
    return this.pricingService.updateFareRules(dto, req.user);
  }

  // ==========================================
  // Tab 2: Zone Pricing
  // ==========================================
  @Get('/zone-rules')
  @ApiQuery({ name: 'companyId', required: false })
  async getZoneRules(@Req() req: any, @Query('companyId') companyId?: string) {
    return this.pricingService.getZoneRules(req.user, companyId);
  }

  @Post('/zone-rules')
  async addZoneRule(@Body() dto: CreateZoneRuleDto, @Req() req: any) {
    return this.pricingService.addZoneRule(dto, req.user);
  }

  @Put('/zone-rules')
  async updateZoneRulePut(@Body() dto: UpdateZoneRuleDto, @Req() req: any) {
    return this.pricingService.updateZoneRule(dto, req.user);
  }

  @Delete('/zone-rules')
  @ApiQuery({ name: 'companyId', required: false })
  async deleteZoneRule(
    @Body() dto: DeleteZoneRuleDto,
    @Req() req: any,
    @Query('companyId') companyId?: string,
  ) {
    return this.pricingService.deleteZoneRule(dto, req.user, undefined, companyId);
  }

  // ==========================================
  // Tab 3: Waiting Charges
  // ==========================================
  @Get('/waiting-charges')
  @ApiQuery({ name: 'companyId', required: false })
  async getWaitingCharges(
    @Req() req: any,
    @Query('companyId') companyId?: string,
  ) {
    return this.pricingService.getWaitingCharges(req.user, companyId);
  }

  @Post('/waiting-charges')
  async saveWaitingChargesPost(
    @Body() dto: UpdateWaitingChargesDto,
    @Req() req: any,
  ) {
    return this.pricingService.updateWaitingCharges(dto, req.user);
  }

  @Put('/waiting-charges')
  async updateWaitingChargesPut(
    @Body() dto: UpdateWaitingChargesDto,
    @Req() req: any,
  ) {
    return this.pricingService.updateWaitingCharges(dto, req.user);
  }
}

