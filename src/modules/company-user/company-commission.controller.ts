import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompanyUserService } from './company-user.service';
import { UpdateDriverCommissionDto } from 'src/common/dto/commission.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { COMPANY_STAFF_ROLES, UserRole } from 'src/common/enums/user/role.enum';

@ApiTags('Company Commission')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('company/commission')
export class CompanyCommissionController {
  constructor(private readonly companyUserService: CompanyUserService) {}

  @Get()
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({
    summary:
      'Get company commission settings (Superadmin rate on company & Company default rate on drivers)',
  })
  async getCommission(@Req() req: any) {
    return this.companyUserService.getMyCompanyCommission(req.user);
  }

  @Patch()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Update default driver commission charged by the company',
  })
  async updateDefaultDriverCommission(
    @Body() dto: UpdateDriverCommissionDto,
    @Req() req: any,
  ) {
    return this.companyUserService.updateMyCompanyDefaultDriverCommission(
      dto,
      req.user,
    );
  }
}
