import {
  Body,
  Controller,
  Get,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { LegalPageType } from 'src/common/enums/legal/legal-page-type.enum';
import { COMPANY_STAFF_ROLES, UserRole } from 'src/common/enums/user/role.enum';
import { LegalService } from './legal.service';
import { UpdateLegalPageDto } from './dto/update-legal-page.dto';

// The company admin owns the content of his company, a superadmin may edit the
// pages of any company.
const LEGAL_EDITOR_ROLES = [
  UserRole.COMPANY_ADMIN,
  UserRole.ADMIN,
  UserRole.SUPERADMIN,
];

// The company staff and the app users only read the pages.
const LEGAL_READER_ROLES = [
  ...LEGAL_EDITOR_ROLES,
  ...COMPANY_STAFF_ROLES,
  UserRole.USER,
  UserRole.PASSENGER,
  UserRole.DRIVER,
];

@ApiTags('Legal Pages')
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
  @ApiQuery({ name: 'companyId', required: false })
  @ApiOperation({ summary: 'Privacy policy of the company' })
  getPrivacyPolicy(@Req() req: any, @Query('companyId') companyId?: string) {
    return this.legalService.getPage(
      req.user,
      LegalPageType.PRIVACY_POLICY,
      companyId,
    );
  }

  @Put('/privacy-policy')
  @Roles(...LEGAL_EDITOR_ROLES)
  @ApiOperation({
    summary:
      'Create or update the privacy policy (any company for a superadmin)',
  })
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
  @ApiQuery({ name: 'companyId', required: false })
  @ApiOperation({ summary: 'Terms and conditions of the company' })
  getTermsAndConditions(
    @Req() req: any,
    @Query('companyId') companyId?: string,
  ) {
    return this.legalService.getPage(
      req.user,
      LegalPageType.TERMS_AND_CONDITIONS,
      companyId,
    );
  }

  @Put('/terms-and-conditions')
  @Roles(...LEGAL_EDITOR_ROLES)
  @ApiOperation({
    summary:
      'Create or update the terms and conditions (any company for a superadmin)',
  })
  saveTermsAndConditions(@Req() req: any, @Body() dto: UpdateLegalPageDto) {
    return this.legalService.savePage(
      req.user,
      LegalPageType.TERMS_AND_CONDITIONS,
      dto,
    );
  }
}
