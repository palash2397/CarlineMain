import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse as SwaggerApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CompanyTripsService } from './company-trips.service';
import { CompanyCustomersService } from './company-customers.service';
import {
  GetCompanyTripsQueryDto,
  CompanyTripStatusFilter,
} from './dto/get-company-trips-query.dto';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole, COMPANY_STAFF_ROLES } from 'src/common/enums/user/role.enum';
import { RideService } from '../ride/ride.service';
import { CreateDispatcherBookingDto } from '../ride/dto/create-dispatcher-booking.dto';
import { ModifyRideDto } from '../ride/dto/modify-ride.dto';
import { AssignDriverDto, CancelTripDto } from './dto/assign-cancel-trip.dto';

@ApiTags('Company Trips')
@Controller('company/trips')
export class CompanyTripsController {
  constructor(
    private readonly companyTripsService: CompanyTripsService,
    private readonly rideService: RideService,
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

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({
    summary:
      'Dispatcher-created booking: Create a trip on behalf of a passenger or guest customer',
  })
  async createCompanyTrip(
    @Req() req: any,
    @Body() dto: CreateDispatcherBookingDto,
  ) {
    return this.rideService.bookDispatcherRide(req.user, dto);
  }

  @Patch(':id/modify')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({
    summary:
      'Modify trip details (pickup, dropoff, vehicle, schedule, driver, notes, payment)',
  })
  @ApiParam({ name: 'id', description: 'Trip / Ride ID' })
  async modifyCompanyTrip(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ModifyRideDto,
  ) {
    return this.rideService.modifyRide(req.user, id, dto);
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

  @Get('active')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Get active company driver trips (Auto-creates 1 active trip if none exist)' })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Active company trips fetched successfully' })
  async getCompanyActiveTrips(
    @Query() query: GetCompanyTripsQueryDto,
    @Req() req: any,
  ) {
    return this.companyTripsService.getCompanyActiveTrips(query, req.user);
  }

  @Patch(':id/auto-assign')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Auto assign driver to pending booking (PATCH)' })
  @ApiParam({ name: 'id', description: 'Trip / Ride ID' })
  @SwaggerApiResponse({ status: 200, description: 'Driver auto-assigned successfully' })
  async autoAssignCompanyTripPatch(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.companyTripsService.autoAssignDriver(id, req.user);
  }

  @Post(':id/auto-assign')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Auto assign driver to pending booking (POST)' })
  @ApiParam({ name: 'id', description: 'Trip / Ride ID' })
  @SwaggerApiResponse({ status: 200, description: 'Driver auto-assigned successfully' })
  async autoAssignCompanyTripPost(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.companyTripsService.autoAssignDriver(id, req.user);
  }

  @Patch(':id/assign-driver')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Manually assign driver to booking (PATCH)' })
  @ApiParam({ name: 'id', description: 'Trip / Ride ID' })
  @SwaggerApiResponse({ status: 200, description: 'Driver assigned successfully' })
  async manualAssignCompanyTripPatch(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AssignDriverDto,
  ) {
    return this.companyTripsService.manualAssignDriver(id, dto.driverId, req.user);
  }

  @Post(':id/assign-driver')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Manually assign driver to booking (POST)' })
  @ApiParam({ name: 'id', description: 'Trip / Ride ID' })
  @SwaggerApiResponse({ status: 200, description: 'Driver assigned successfully' })
  async manualAssignCompanyTripPost(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AssignDriverDto,
  ) {
    return this.companyTripsService.manualAssignDriver(id, dto.driverId, req.user);
  }

  @Patch(':id/cancel')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Cancel company booking (PATCH)' })
  @ApiParam({ name: 'id', description: 'Trip / Ride ID' })
  @SwaggerApiResponse({ status: 200, description: 'Trip cancelled successfully' })
  async cancelCompanyTripPatch(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CancelTripDto,
  ) {
    return this.companyTripsService.cancelCompanyTrip(id, dto.cancelReason, req.user);
  }

  @Post(':id/cancel')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Cancel company booking (POST)' })
  @ApiParam({ name: 'id', description: 'Trip / Ride ID' })
  @SwaggerApiResponse({ status: 200, description: 'Trip cancelled successfully' })
  async cancelCompanyTripPost(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CancelTripDto,
  ) {
    return this.companyTripsService.cancelCompanyTrip(id, dto?.cancelReason, req.user);
  }

  @Delete(':id/cancel')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Cancel company booking (DELETE)' })
  @ApiParam({ name: 'id', description: 'Trip / Ride ID' })
  @SwaggerApiResponse({ status: 200, description: 'Trip cancelled successfully' })
  async cancelCompanyTripDelete(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CancelTripDto,
  ) {
    return this.companyTripsService.cancelCompanyTrip(id, dto?.cancelReason, req.user);
  }

  @Delete(':id/delete')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Delete company booking (DELETE /delete)' })
  @ApiParam({ name: 'id', description: 'Trip / Ride ID' })
  @SwaggerApiResponse({ status: 200, description: 'Trip deleted successfully' })
  async deleteCompanyTripPath(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.companyTripsService.deleteCompanyTrip(id, req.user);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Delete company booking (DELETE /:id)' })
  @ApiParam({ name: 'id', description: 'Trip / Ride ID' })
  @SwaggerApiResponse({ status: 200, description: 'Trip deleted successfully' })
  async deleteCompanyTrip(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.companyTripsService.deleteCompanyTrip(id, req.user);
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