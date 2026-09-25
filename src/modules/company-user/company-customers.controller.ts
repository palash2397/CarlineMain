import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse as SwaggerApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CompanyCustomersService } from './company-customers.service';
import {
  GetCompanyCustomersQueryDto,
  CompanyCustomerStatusFilter,
} from './dto/get-company-customers-query.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole, COMPANY_STAFF_ROLES } from 'src/common/enums/user/role.enum';

@ApiTags('Company Customers')
@Controller('company/customers')
export class CompanyCustomersController {
  constructor(
    private readonly companyCustomersService: CompanyCustomersService,
  ) {}

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
    description: 'Search customer by name, phone, or email',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: CompanyCustomerStatusFilter,
    description: 'Filter by active status (All, Active, Inactive)',
  })
  @ApiQuery({
    name: 'companyId',
    required: false,
    type: String,
    description:
      'Company ID (Allowed for SuperAdmin to inspect specific company customers)',
  })
  async getCompanyCustomers(
    @Query() query: GetCompanyCustomersQueryDto,
    @Req() req: any,
  ) {
    return this.companyCustomersService.getCompanyCustomers(query, req.user);
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
  async getCompanyCustomerById(@Param('id') id: string, @Req() req: any) {
    return this.companyCustomersService.getCompanyCustomerById(id, req.user);
  }
}
