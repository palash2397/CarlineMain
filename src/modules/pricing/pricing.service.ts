import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pricing, PricingDocument } from './schema/pricing.schema';
import { Company, CompanyDocument } from '../super-admin/schema/company.schema';
import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';
import { UpdateFareRulesDto } from './dto/update-fare-rules.dto';
import { CreateZoneRuleDto } from './dto/create-zone-rule.dto';
import { UpdateZoneRuleDto } from './dto/update-zone-rule.dto';
import { DeleteZoneRuleDto } from './dto/delete-zone-rule.dto';
import { UpdateWaitingChargesDto } from './dto/update-waiting-charges.dto';
import { SavePricingConfigDto } from './dto/save-pricing-config.dto';
import { UserRole } from 'src/common/enums/user/role.enum';

@Injectable()
export class PricingService {
  constructor(
    @InjectModel(Pricing.name)
    private readonly pricingModel: Model<PricingDocument>,
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
  ) {}

  private async resolveCompanyId(
    user: any,
    requestedCompanyId?: string,
  ): Promise<string | null> {
    const userRole = (user?.roles || user?.role || '').toUpperCase();

    if (
      userRole === UserRole.SUPERADMIN ||
      userRole === UserRole.ADMIN ||
      userRole === 'SUPER_ADMIN'
    ) {
      if (requestedCompanyId) {
        return requestedCompanyId;
      }
      if (user?.companyId) {
        return user.companyId;
      }
      // If superadmin didn't provide companyId, pick the first active company or return null
      const firstCompany = await this.companyModel.findOne();
      return firstCompany ? firstCompany._id.toString() : null;
    }

    return user?.companyId || user?.id || null;
  }

  private async getOrCreatePricingDoc(
    companyId: string,
  ): Promise<PricingDocument> {
    let pricing = await this.pricingModel.findOne({ companyId });
    if (!pricing) {
      pricing = await this.pricingModel.create({
        companyId,
        zonePricing: [],
      });
    }
    return pricing;
  }

  async getPricingConfig(user: any, companyIdQuery?: string) {
    try {
      const companyId = await this.resolveCompanyId(user, companyIdQuery);
      if (!companyId) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      const pricing = await this.pricingModel.findOne({ companyId });
      if (!pricing) {
        return new ApiResponse(404, {}, Msg.PRICING_NOT_CONFIGURED);
      }

      const data = {
        companyId: pricing.companyId,
        fareRules: pricing.fareRules || null,
        zonePricing: (pricing.zonePricing || []).map((r: any) =>
          this.formatZoneRule(r),
        ),
        waitingCharges: pricing.waitingCharges || null,
        updatedBy: pricing.updatedBy || null,
        updatedAt: (pricing as any).updatedAt,
      };

      return new ApiResponse(200, data, Msg.PRICING_FETCHED);
    } catch (error) {
      console.error('Error while getting all pricing config:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================
  // Tab 1: Fare Rules
  // ==========================================
  async getFareRules(user: any, companyIdQuery?: string) {
    try {
      const companyId = await this.resolveCompanyId(user, companyIdQuery);
      if (!companyId) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      const pricing = await this.pricingModel.findOne({ companyId });
      console.log('pricing ----------->', pricing);
      if (!pricing || !pricing.fareRules) {
        return new ApiResponse(404, {}, Msg.PRICING_NOT_CONFIGURED);
      }

      return new ApiResponse(200, pricing.fareRules, Msg.PRICING_FETCHED);
    } catch (error) {
      console.error('Error while getting fare rules:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async updateFareRules(dto: UpdateFareRulesDto, user: any) {
    try {
      const companyId = await this.resolveCompanyId(user, dto.companyId);
      if (!companyId) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      const pricing = await this.getOrCreatePricingDoc(companyId);
      pricing.fareRules = {
        baseFare: dto.baseFare,
        minimumFare: dto.minimumFare,
        perKmRate: dto.perKmRate,
        perMinuteRate: dto.perMinuteRate,
      };
      pricing.updatedBy = user.email || user.id;

      await pricing.save();

      return new ApiResponse(200, pricing.fareRules, Msg.FARE_RULES_UPDATED);
    } catch (error) {
      console.error('Error while updating fare rules:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  private formatZoneRule(rule: any) {
    if (!rule) return rule;
    const obj =
      typeof rule.toObject === 'function' ? rule.toObject() : { ...rule };
    return {
      id: (obj._id || obj.id)?.toString(),
      zoneName: obj.zoneName,
      baseFareSurcharge: obj.baseFareSurcharge,
      multiplier: obj.multiplier,
      status: obj.status,
      ...(obj.createdAt ? { createdAt: obj.createdAt } : {}),
      ...(obj.updatedAt ? { updatedAt: obj.updatedAt } : {}),
    };
  }

  // ==========================================
  // Tab 2: Zone Pricing
  // ==========================================
  async getZoneRules(user: any, companyIdQuery?: string) {
    try {
      const companyId = await this.resolveCompanyId(user, companyIdQuery);
      if (!companyId) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      const pricing = await this.pricingModel.findOne({ companyId });
      const zonePricing = (pricing?.zonePricing || []).map((rule: any) =>
        this.formatZoneRule(rule),
      );
      return new ApiResponse(200, zonePricing, Msg.PRICING_FETCHED);
    } catch (error) {
      console.error('Error while getting zone rules:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async addZoneRule(dto: CreateZoneRuleDto, user: any) {
    try {
      const companyId = await this.resolveCompanyId(user, dto.companyId);
      if (!companyId) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      const pricing = await this.getOrCreatePricingDoc(companyId);

      const newRule: any = {
        _id: new Types.ObjectId(),
        zoneName: dto.zoneName.trim(),
        baseFareSurcharge: dto.baseFareSurcharge,
        multiplier: dto.multiplier,
        status: dto.status || 'Active',
      };

      pricing.zonePricing.push(newRule);
      pricing.updatedBy = user.email || user.id;

      await pricing.save();

      return new ApiResponse(
        201,
        this.formatZoneRule(newRule),
        Msg.ZONE_RULE_CREATED,
      );
    } catch (error) {
      console.error('Error while adding zone rule:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async updateZoneRule(
    dto: UpdateZoneRuleDto,
    user: any,
    paramRuleId?: string,
  ) {
    try {
      const targetRuleId = paramRuleId || dto?.id;
      if (!targetRuleId) {
        return new ApiResponse(400, {}, Msg.ID_REQUIRED);
      }

      const companyId = await this.resolveCompanyId(user, dto?.companyId);
      if (!companyId) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      const pricing = await this.getOrCreatePricingDoc(companyId);

      const rule = pricing.zonePricing.find(
        (r: any) => r._id.toString() === targetRuleId,
      );
      if (!rule) {
        return new ApiResponse(404, {}, Msg.ZONE_RULE_NOT_FOUND);
      }

      if (dto.zoneName !== undefined) rule.zoneName = dto.zoneName.trim();
      if (dto.baseFareSurcharge !== undefined)
        rule.baseFareSurcharge = dto.baseFareSurcharge;
      if (dto.multiplier !== undefined) rule.multiplier = dto.multiplier;
      if (dto.status !== undefined) rule.status = dto.status;

      pricing.updatedBy = user.email || user.id;
      await pricing.save();

      return new ApiResponse(
        200,
        this.formatZoneRule(rule),
        Msg.ZONE_RULE_UPDATED,
      );
    } catch (error) {
      console.error('Error while updating zone rule:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async deleteZoneRule(
    dto: DeleteZoneRuleDto,
    user: any,
    paramRuleId?: string,
    companyIdQuery?: string,
  ) {
    try {
      const targetRuleId = paramRuleId || dto?.id;
      if (!targetRuleId) {
        return new ApiResponse(400, {}, Msg.ID_REQUIRED);
      }

      const companyId = await this.resolveCompanyId(
        user,
        dto?.companyId || companyIdQuery,
      );
      if (!companyId) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      const pricing = await this.getOrCreatePricingDoc(companyId);

      const ruleIndex = pricing.zonePricing.findIndex(
        (r: any) => r._id.toString() === targetRuleId,
      );
      if (ruleIndex === -1) {
        return new ApiResponse(404, {}, Msg.ZONE_RULE_NOT_FOUND);
      }

      pricing.zonePricing.splice(ruleIndex, 1);
      pricing.updatedBy = user.email || user.id;

      await pricing.save();

      return new ApiResponse(200, {}, Msg.ZONE_RULE_DELETED);
    } catch (error) {
      console.error('Error while deleting zone rule:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ==========================================
  // Tab 3: Waiting Charges
  // ==========================================
  async getWaitingCharges(user: any, companyIdQuery?: string) {
    try {
      const companyId = await this.resolveCompanyId(user, companyIdQuery);
      if (!companyId) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      const pricing = await this.pricingModel.findOne({ companyId });
      if (!pricing || !pricing.waitingCharges) {
        return new ApiResponse(404, {}, Msg.PRICING_NOT_CONFIGURED);
      }

      return new ApiResponse(200, pricing.waitingCharges, Msg.PRICING_FETCHED);
    } catch (error) {
      console.error('Error while getting waiting charges:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  async updateWaitingCharges(dto: UpdateWaitingChargesDto, user: any) {
    try {
      const companyId = await this.resolveCompanyId(user, dto.companyId);
      if (!companyId) {
        return new ApiResponse(404, {}, Msg.COMPANY_NOT_FOUND);
      }

      const pricing = await this.getOrCreatePricingDoc(companyId);
      pricing.waitingCharges = {
        gracePeriodMinutes: dto.gracePeriodMinutes,
        waitingChargePerMinute: dto.waitingChargePerMinute,
      };
      pricing.updatedBy = user.email || user.id;

      await pricing.save();

      return new ApiResponse(
        200,
        pricing.waitingCharges,
        Msg.WAITING_CHARGES_UPDATED,
      );
    } catch (error) {
      console.error('Error while updating waiting charges:', error);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }
}
