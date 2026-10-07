import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiResponse as SwaggerApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CompanyCustomersService } from './company-customers.service';
import {
  GetCompanyCustomersQueryDto,
  CompanyCustomerStatusFilter,
} from './dto/get-company-customers-query.dto';
import { CreateCompanyCustomerDto } from './dto/create-company-customer.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole, COMPANY_STAFF_ROLES } from 'src/common/enums/user/role.enum';

@ApiTags('Company Customers (by Prakash)')
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
  @ApiOperation({ summary: 'Get all company ride history customers (Original API)' })
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
  @SwaggerApiResponse({ status: 200, description: 'Company customer list fetched successfully' })
  async getCompanyCustomers(
    @Query() query: GetCompanyCustomersQueryDto,
    @Req() req: any,
  ) {
    return this.companyCustomersService.getCompanyCustomers(query, req.user);
  }

  @Get('same-company')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Get list of customers belonging strictly to the company (NEW API)' })
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
    description: 'Company ID (Allowed for SuperAdmin)',
  })
  @SwaggerApiResponse({ status: 200, description: 'Strict company customers fetched successfully' })
  async getSameCompanyCustomers(
    @Query() query: GetCompanyCustomersQueryDto,
    @Req() req: any,
  ) {
    return this.companyCustomersService.getSameCompanyCustomers(query, req.user);
  }

  @Post('add')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Add new customer for company and email login password (NEW API)' })
  @ApiBody({ type: CreateCompanyCustomerDto })
  @SwaggerApiResponse({ status: 201, description: 'Customer created successfully and password emailed' })
  async addCompanyCustomer(
    @Body() dto: CreateCompanyCustomerDto,
    @Req() req: any,
  ) {
    return this.companyCustomersService.createCompanyCustomer(dto, req.user);
  }


  @Get('live-map')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Get live map drivers & active trips for dispatcher/admin' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['All', 'AVAILABLE', 'ON_TRIP', 'OFFLINE'] })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Live map data fetched successfully' })
  async getCompanyLiveMap(
    @Query() query: any,
    @Req() req: any,
  ) {
    return this.companyCustomersService.getCompanyLiveMap(query, req.user);
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
  @ApiOperation({ summary: 'Get single company customer details & trip history' })
  @ApiParam({ name: 'id', description: 'Customer User ID' })
  @SwaggerApiResponse({ status: 200, description: 'Customer details fetched successfully' })
  async getCompanyCustomerById(@Param('id') id: string, @Req() req: any) {
    return this.companyCustomersService.getCompanyCustomerById(id, req.user);
  }

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Add/register customer for company (Alias endpoint)' })
  @ApiBody({ type: CreateCompanyCustomerDto })
  @SwaggerApiResponse({ status: 201, description: 'Customer registered successfully' })
  async createCompanyCustomer(
    @Body() dto: CreateCompanyCustomerDto,
    @Req() req: any,
  ) {
    return this.companyCustomersService.createCompanyCustomer(dto, req.user);
  }

}