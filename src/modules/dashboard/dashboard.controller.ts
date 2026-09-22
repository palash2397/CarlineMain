import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiQuery,
  ApiResponse as SwaggerApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { DashboardService } from './dashboard.service';
import { GetDashboardQueryDto } from './dto/get-dashboard-query.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole, COMPANY_STAFF_ROLES } from 'src/common/enums/user/role.enum';
import { DashboardTimeframe } from 'src/common/enums/companies/dashboard-time-frame.enum';

@ApiTags('Company Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('/overview')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiQuery({
    name: 'timeframe',
    required: false,
    enum: DashboardTimeframe,
    description:
      'Timeframe filter (today, yesterday, week, month, year, custom)',
  })
  @ApiQuery({
    name: 'companyId',
    required: false,
    type: String,
    description:
      'Company ID filter (allowed for SuperAdmin to view specific company metrics)',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date for custom timeframe (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date for custom timeframe (YYYY-MM-DD)',
  })
  async getDashboardOverview(
    @Query() query: GetDashboardQueryDto,
    @Req() req: any,
  ) {
    return this.dashboardService.getDashboardOverview(query, req.user);
  }
}
