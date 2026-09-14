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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CompanyUserService } from './company-user.service';
import { CreateCompanyUserDto } from './dto/create-company-user.dto';
import { UpdateCompanyUserDto } from './dto/update-company-user.dto';
import { UpdateCompanyUserStatusDto } from './dto/update-company-user-status.dto';
import { GetCompanyUsersQueryDto } from './dto/get-company-users-query.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole } from 'src/common/enums/user/role.enum';

@ApiTags('Company Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(UserRole.COMPANY_ADMIN)
@Controller('company/users')
export class CompanyUserController {
  constructor(private readonly companyUserService: CompanyUserService) {}

  @Post()
  async createCompanyUser(@Body() dto: CreateCompanyUserDto, @Req() req: any) {
    return this.companyUserService.createCompanyUser(dto, req.user);
  }

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['All', 'Active', 'Inactive'],
  })
  async getCompanyUsers(
    @Query() query: GetCompanyUsersQueryDto,
    @Req() req: any,
  ) {
    return this.companyUserService.getCompanyUsers(query, req.user);
  }

  @Get(':id')
  async getCompanyUserById(@Param('id') id: string, @Req() req: any) {
    return this.companyUserService.getCompanyUserById(id, req.user);
  }

  @Put()
  async updateCompanyUser(@Body() dto: UpdateCompanyUserDto, @Req() req: any) {
    return this.companyUserService.updateCompanyUser(dto, req.user);
  }

  @Patch('/status')
  async updateCompanyUserStatus(
    @Body() dto: UpdateCompanyUserStatusDto,
    @Req() req: any,
  ) {
    return this.companyUserService.updateCompanyUserStatus(dto, req.user);
  }

  @Post(':id/resend-credentials')
  async resendCredentials(@Param('id') id: string, @Req() req: any) {
    return this.companyUserService.resendCredentials(id, req.user);
  }

  @Delete(':id')
  async deleteCompanyUser(@Param('id') id: string, @Req() req: any) {
    return this.companyUserService.deleteCompanyUser(id, req.user);
  }
}
