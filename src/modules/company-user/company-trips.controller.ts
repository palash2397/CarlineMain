import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse as SwaggerApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CompanyTripsService } from './company-trips.service';
import {
  GetCompanyTripsQueryDto,
  CompanyTripStatusFilter,
} from './dto/get-company-trips-query.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole, COMPANY_STAFF_ROLES } from 'src/common/enums/user/role.enum';

@ApiTags('Company Trips')
@Controller('company/trips')
export class CompanyTripsController {
  constructor(private readonly companyTripsService: CompanyTripsService) {}

  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description:
      'Search across trip ID, customer name, phone, driver name, pickup, dropoff',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: CompanyTripStatusFilter,
    description:
      'Status tab filter (All, Pending, Dispatched, Ongoing, Completed, Cancelled, Scheduled)',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date filter (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date filter (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'companyId',
    required: false,
    type: String,
    description:
      'Company ID (allowed for SuperAdmin to inspect specific company trips)',
  })
  async getCompanyTrips(
    @Query() query: GetCompanyTripsQueryDto,
    @Req() req: any,
  ) {
    return this.companyTripsService.getCompanyTrips(query, req.user);
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  async getCompanyTripById(@Param('id') id: string, @Req() req: any) {
    return this.companyTripsService.getCompanyTripById(id, req.user);
  }
}
