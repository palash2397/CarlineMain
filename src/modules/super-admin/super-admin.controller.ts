import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { multerConfig } from 'src/common/middlewares/multer';

import { SuperAdminService } from './super-admin.service';
import { SuperAdminLoginDto } from './dto/super-admin-login.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanyStatusDto } from './dto/update-company-status.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole } from 'src/common/enums/user/role.enum';

@ApiTags('Super Admin')
@Controller('super-admin')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Post('/login')
  async login(@Body() dto: SuperAdminLoginDto) {
    return this.superAdminService.login(dto);
  }

  @Post('/companies')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.SUPERADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateCompanyDto })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'documents', maxCount: 10 },
        { name: 'documentFiles', maxCount: 10 },
        { name: 'documentFile', maxCount: 10 },
      ],
      multerConfig('company', [
        'png',
        'jpg',
        'jpeg',
        'webp',
        'svg',
        'pdf',
        'doc',
        'docx',
      ]),
    ),
  )
  async createCompany(
    @Body() dto: CreateCompanyDto,
    @UploadedFiles()
    files: {
      logo?: Express.Multer.File[];
      documents?: Express.Multer.File[];
      documentFiles?: Express.Multer.File[];
      documentFile?: Express.Multer.File[];
    },
    @Req() req: any,
  ) {
    return this.superAdminService.createCompany(dto, files, req.user);
  }

  @Get('/companies')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.SUPERADMIN)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['All Statuses', 'Active', 'Suspended', 'Inactive'],
  })
  @ApiQuery({ name: 'city', required: false, type: String })
  async getCompanies(@Query() query: any) {
    return this.superAdminService.getCompanies(query);
  }

  @Get('/companies/:id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.SUPERADMIN)
  async getCompanyById(@Param('id') id: string) {
    return this.superAdminService.getCompanyById(id);
  }

  @Put('/companies/:id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.SUPERADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateCompanyDto })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'logo', maxCount: 1 },
        { name: 'documents', maxCount: 10 },
        { name: 'documentFiles', maxCount: 10 },
        { name: 'documentFile', maxCount: 10 },
      ],
      multerConfig('company', [
        'png',
        'jpg',
        'jpeg',
        'webp',
        'svg',
        'pdf',
        'doc',
        'docx',
      ]),
    ),
  )
  async updateCompany(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @UploadedFiles()
    files: {
      logo?: Express.Multer.File[];
      documents?: Express.Multer.File[];
      documentFiles?: Express.Multer.File[];
      documentFile?: Express.Multer.File[];
    },
  ) {
    return this.superAdminService.updateCompany(id, dto, files);
  }

  @Patch('/companies/status')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.SUPERADMIN)
  async updateCompanyStatus(@Body() dto: UpdateCompanyStatusDto) {
    return this.superAdminService.updateCompanyStatus(dto);
  }
}
