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
  UploadedFile,
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
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from 'src/common/middlewares/multer';
import { VehicleTypeService } from './vehicle-type.service';
import { CreateVehicleTypeDto } from './dto/create-vehicle-type.dto';
import { UpdateVehicleTypeDto } from './dto/update-vehicle-type.dto';
import { UpdateVehicleTypeStatusDto } from './dto/update-vehicle-type-status.dto';
import { GetVehicleTypesQueryDto } from './dto/get-vehicle-types-query.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole } from 'src/common/enums/user/role.enum';

@ApiTags('Super Admin - Vehicle Types')
@Controller('super-admin/vehicle-types')
export class VehicleTypeController {
  constructor(private readonly vehicleTypeService: VehicleTypeService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ type: CreateVehicleTypeDto })
  @UseInterceptors(
    FileInterceptor(
      'image',
      multerConfig('vehicle-types', ['png', 'jpg', 'jpeg', 'webp', 'svg']),
    ),
  )
  async createVehicleType(
    @Body() dto: CreateVehicleTypeDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.vehicleTypeService.createVehicleType(dto, file, req.user);
  }

  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['All', 'Active', 'Inactive'],
  })
  async getVehicleTypes(@Query() query: GetVehicleTypesQueryDto) {
    return this.vehicleTypeService.getVehicleTypes(query);
  }

  @Get('/active')
  async getActiveVehicleTypes() {
    return this.vehicleTypeService.getActiveVehicleTypes();
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  async getVehicleTypeById(@Param('id') id: string) {
    return this.vehicleTypeService.getVehicleTypeById(id);
  }

  @Put('/update')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({ type: UpdateVehicleTypeDto })
  @UseInterceptors(
    FileInterceptor(
      'image',
      multerConfig('vehicle-types', ['png', 'jpg', 'jpeg', 'webp', 'svg']),
    ),
  )
  async updateVehicleType(
    @Body() dto: UpdateVehicleTypeDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.vehicleTypeService.updateVehicleType(dto, file);
  }

  @Patch('/status')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  async updateVehicleTypeStatus(@Body() dto: UpdateVehicleTypeStatusDto) {
    return this.vehicleTypeService.updateVehicleTypeStatus(dto);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.SUPERADMIN, UserRole.ADMIN)
  async deleteVehicleType(@Param('id') id: string) {
    return this.vehicleTypeService.deleteVehicleType(id);
  }
}
