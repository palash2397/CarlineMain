import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
  ApiOperation,
  ApiQuery,
  ApiResponse as SwaggerApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { multerConfig } from 'src/common/middlewares/multer';
import { DriverService } from './driver.service';
import { RegisterDriverDto } from './dto/register-driver.dto';
import { GetCompanyDriversQueryDto } from './dto/get-company-drivers-query.dto';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';
import { UpdateDriverProfileDto } from './dto/update-driver-profile.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole, COMPANY_STAFF_ROLES } from 'src/common/enums/user/role.enum';
import { DriverStatus } from 'src/common/enums/driver/status-enum';

@ApiTags('Driver')
@Controller('driver')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Post('/register')
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ type: RegisterDriverDto })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'governmentId', maxCount: 1 },
        { name: 'licenseCopy', maxCount: 1 },
        { name: 'vehicleRegistrationDoc', maxCount: 1 },
        { name: 'insuranceProof', maxCount: 1 },
      ],
      multerConfig('driver', ['png', 'jpg', 'jpeg', 'webp', 'pdf']),
    ),
  )
  @SwaggerApiResponse({
    status: 201,
    description:
      'Driver application submitted successfully and pending company approval',
  })
  async register(
    @Body() dto: RegisterDriverDto,
    @UploadedFiles()
    files?: {
      governmentId?: Express.Multer.File[];
      licenseCopy?: Express.Multer.File[];
      vehicleRegistrationDoc?: Express.Multer.File[];
      insuranceProof?: Express.Multer.File[];
    },
  ) {
    return this.driverService.registerDriver(dto, files);
  }

  @Get('/company-drivers/all')
  // @ApiBearerAuth('access-token')
  // @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['All', ...Object.values(DriverStatus)],
  })
  @ApiQuery({ name: 'vehicleType', required: false, type: String })
  async getCompanyDrivers(
    @Query() query: GetCompanyDriversQueryDto,
    @Req() req: any,
  ) {
    return this.driverService.getCompanyDrivers(query, req.user.id);
  }

  @Patch(['/status'])
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  async updateDriverStatus(
    @Body() dto: UpdateDriverStatusDto,
    @Req() req: any,
  ) {
    return this.driverService.updateDriverStatus(dto, req.user.id);
  }

  @Get('/profile')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@Req() req: any) {
    return this.driverService.getMyProfile(req.user.id);
  }

  @Patch('/profile')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ type: UpdateDriverProfileDto })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'governmentId', maxCount: 1 },
        { name: 'licenseCopy', maxCount: 1 },
        { name: 'vehicleRegistrationDoc', maxCount: 1 },
        { name: 'insuranceProof', maxCount: 1 },
      ],
      multerConfig('driver', ['png', 'jpg', 'jpeg', 'webp', 'pdf']),
    ),
  )
  async updateMyProfile(
    @Req() req: any,
    @Body() dto: UpdateDriverProfileDto,
    @UploadedFiles()
    files?: {
      avatar?: Express.Multer.File[];
      governmentId?: Express.Multer.File[];
      licenseCopy?: Express.Multer.File[];
      vehicleRegistrationDoc?: Express.Multer.File[];
      insuranceProof?: Express.Multer.File[];
    },
  ) {
    return this.driverService.updateMyProfile(req.user.id, dto, files);
  }

  @Get('/companies/all')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  async getAllCompanies() {
    return this.driverService.allCompanies();
  }
}
