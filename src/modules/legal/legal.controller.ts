import {
  Body,
  Controller,
  Get,
  Patch,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { multerConfig } from 'src/common/middlewares/multer';
import { LegalPageType } from 'src/common/enums/legal/legal-page-type.enum';
import { UserRole } from 'src/common/enums/user/role.enum';
import { LegalService } from './legal.service';
import { UpdateLegalPageDto } from './dto/update-legal-page.dto';
import { EditLegalPageDto } from './dto/edit-legal-page.dto';

// The privacy policy and the terms and conditions belong to the deployment and
// not to a company, so only a superadmin writes them.
const LEGAL_EDITOR_ROLES = [UserRole.SUPERADMIN];

// The banner of a page is uploaded as form-data, the same way as the other
// images of the superadmin panel.
const BANNER_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'svg'];

@ApiTags('Legal Pages (by Prakash)')
@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  // ==========================================
  // Privacy Policy
  // ==========================================
  // The app shows the page before login, so the read is public.
  @Get('/privacy-policy')
  @ApiOperation({
    summary: 'Privacy policy of the deployment, no token needed',
  })
  getPrivacyPolicy() {
    return this.legalService.getPage(LegalPageType.PRIVACY_POLICY);
  }

  @Put('/privacy-policy')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(...LEGAL_EDITOR_ROLES)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateLegalPageDto })
  @UseInterceptors(
    FileInterceptor('image', multerConfig('legal', BANNER_EXTENSIONS)),
  )
  @ApiOperation({ summary: 'Create or update the privacy policy' })
  savePrivacyPolicy(
    @Req() req: any,
    @Body() dto: UpdateLegalPageDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.legalService.savePage(
      req.user,
      LegalPageType.PRIVACY_POLICY,
      dto,
      image,
    );
  }

  @Patch('/privacy-policy')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(...LEGAL_EDITOR_ROLES)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: EditLegalPageDto })
  @UseInterceptors(
    FileInterceptor('image', multerConfig('legal', BANNER_EXTENSIONS)),
  )
  @ApiOperation({ summary: 'Edit a field of the privacy policy' })
  editPrivacyPolicy(
    @Req() req: any,
    @Body() dto: EditLegalPageDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.legalService.editPage(
      req.user,
      LegalPageType.PRIVACY_POLICY,
      dto,
      image,
    );
  }

  // ==========================================
  // Terms and Conditions
  // ==========================================
  // The app shows the page before login, so the read is public.
  @Get('/terms-and-conditions')
  @ApiOperation({
    summary: 'Terms and conditions of the deployment, no token needed',
  })
  getTermsAndConditions() {
    return this.legalService.getPage(LegalPageType.TERMS_AND_CONDITIONS);
  }

  @Put('/terms-and-conditions')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(...LEGAL_EDITOR_ROLES)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateLegalPageDto })
  @UseInterceptors(
    FileInterceptor('image', multerConfig('legal', BANNER_EXTENSIONS)),
  )
  @ApiOperation({ summary: 'Create or update the terms and conditions' })
  saveTermsAndConditions(
    @Req() req: any,
    @Body() dto: UpdateLegalPageDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.legalService.savePage(
      req.user,
      LegalPageType.TERMS_AND_CONDITIONS,
      dto,
      image,
    );
  }

  @Patch('/terms-and-conditions')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(...LEGAL_EDITOR_ROLES)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: EditLegalPageDto })
  @UseInterceptors(
    FileInterceptor('image', multerConfig('legal', BANNER_EXTENSIONS)),
  )
  @ApiOperation({ summary: 'Edit a field of the terms and conditions' })
  editTermsAndConditions(
    @Req() req: any,
    @Body() dto: EditLegalPageDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.legalService.editPage(
      req.user,
      LegalPageType.TERMS_AND_CONDITIONS,
      dto,
      image,
    );
  }
}
