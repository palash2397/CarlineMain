import {
  Body,
  Controller,
  Delete,
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
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { multerConfig } from 'src/common/middlewares/multer';
import { DriverService } from './driver.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';
import { GetDriversQueryDto } from './dto/get-drivers-query.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole } from 'src/common/enums/user/role.enum';
import { DriverStatus } from 'src/common/enums/driver/status-enum';

@ApiTags('Drivers (Driver Manager)')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(UserRole.DRIVER_MANAGER, UserRole.COMPANY_ADMIN, UserRole.SUPERADMIN)
@Controller('company/drivers')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Post()
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'licenseCopy', maxCount: 1 },
        { name: 'insuranceProof', maxCount: 1 },
      ],
      multerConfig('driver', ['png', 'jpg', 'jpeg', 'pdf']),
    ),
  )
  async createDriver(
    @Body() dto: CreateDriverDto,
    @UploadedFiles()
    files: {
      licenseCopy?: Express.Multer.File[];
      insuranceProof?: Express.Multer.File[];
    },
    @Req() req: any,
  ) {
    return this.driverService.createDriver(dto, files, req.user);
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'All',
      DriverStatus.ACTIVE,
      DriverStatus.INACTIVE,
      DriverStatus.ON_RIDE,
      DriverStatus.OFF_DUTY,
    ],
  })
  @ApiQuery({ name: 'availability', required: false, type: String })
  @ApiQuery({ name: 'dispatchPriority', required: false, type: String })
  @ApiQuery({ name: 'licenseClass', required: false, type: String })
  async getDrivers(@Query() query: GetDriversQueryDto, @Req() req: any) {
    return this.driverService.getDrivers(query, req.user);
  }

  @Get(':id')
  async getDriverById(@Param('id') id: string, @Req() req: any) {
    return this.driverService.getDriverById(id, req.user);
  }

  @Put()
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'licenseCopy', maxCount: 1 },
        { name: 'insuranceProof', maxCount: 1 },
      ],
      multerConfig('driver', ['png', 'jpg', 'jpeg', 'pdf']),
    ),
  )
  async updateDriver(
    @Body() dto: UpdateDriverDto,
    @UploadedFiles()
    files: {
      licenseCopy?: Express.Multer.File[];
      insuranceProof?: Express.Multer.File[];
    },
    @Req() req: any,
  ) {
    return this.driverService.updateDriver(dto, files, req.user);
  }

  @Patch('/status')
  async updateDriverStatus(
    @Body() dto: UpdateDriverStatusDto,
    @Req() req: any,
  ) {
    return this.driverService.updateDriverStatus(dto, req.user);
  }

  @Post(':id/resend-credentials')
  async resendCredentials(@Param('id') id: string, @Req() req: any) {
    return this.driverService.resendCredentials(id, req.user);
  }

  @Delete(':id')
  async deleteDriver(@Param('id') id: string, @Req() req: any) {
    return this.driverService.deleteDriver(id, req.user);
  }
}
