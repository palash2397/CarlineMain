import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { LegalPageType } from 'src/common/enums/legal/legal-page-type.enum';
import { COMPANY_STAFF_ROLES, UserRole } from 'src/common/enums/user/role.enum';
import { LegalService } from './legal.service';
import { UpdateLegalPageDto } from './dto/update-legal-page.dto';

// The privacy policy and the terms and conditions belong to the deployment and
// not to a company, so only a superadmin writes them.
const LEGAL_EDITOR_ROLES = [UserRole.SUPERADMIN];

// Every app user, and the staff of every company, reads the same page.
const LEGAL_READER_ROLES = [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY_ADMIN,
  UserRole.COMPANY_USER,
  ...COMPANY_STAFF_ROLES,
  UserRole.USER,
  UserRole.PASSENGER,
  UserRole.DRIVER,
];

@ApiTags('Legal Pages (by Prakash)')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  // ==========================================
  // Privacy Policy
  // ==========================================
  @Get('/privacy-policy')
  @Roles(...LEGAL_READER_ROLES)
  @ApiOperation({ summary: 'Privacy policy of the deployment' })
  getPrivacyPolicy() {
    return this.legalService.getPage(LegalPageType.PRIVACY_POLICY);
  }

  @Put('/privacy-policy')
  @Roles(...LEGAL_EDITOR_ROLES)
  @ApiOperation({ summary: 'Create or update the privacy policy' })
  savePrivacyPolicy(@Req() req: any, @Body() dto: UpdateLegalPageDto) {
    return this.legalService.savePage(
      req.user,
      LegalPageType.PRIVACY_POLICY,
      dto,
    );
  }

  // ==========================================
  // Terms and Conditions
  // ==========================================
  @Get('/terms-and-conditions')
  @Roles(...LEGAL_READER_ROLES)
  @ApiOperation({ summary: 'Terms and conditions of the deployment' })
  getTermsAndConditions() {
    return this.legalService.getPage(LegalPageType.TERMS_AND_CONDITIONS);
  }

  @Put('/terms-and-conditions')
  @Roles(...LEGAL_EDITOR_ROLES)
  @ApiOperation({ summary: 'Create or update the terms and conditions' })
  saveTermsAndConditions(@Req() req: any, @Body() dto: UpdateLegalPageDto) {
    return this.legalService.savePage(
      req.user,
      LegalPageType.TERMS_AND_CONDITIONS,
      dto,
    );
  }
}
