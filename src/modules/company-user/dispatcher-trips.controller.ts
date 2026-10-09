import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
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
import { RideService } from '../ride/ride.service';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole, COMPANY_STAFF_ROLES } from 'src/common/enums/user/role.enum';
import { CreateDispatcherBookingDto } from '../ride/dto/create-dispatcher-booking.dto';
import { ModifyRideDto } from '../ride/dto/modify-ride.dto';
import { AssignDriverDto, CancelTripDto } from './dto/assign-cancel-trip.dto';
import {
  GetCompanyTripsQueryDto,
  CompanyTripStatusFilter,
} from './dto/get-company-trips-query.dto';

@ApiTags('Dispatcher (by Prakash)')
@Controller('dispatcher')
export class DispatcherTripsController {
  constructor(
    private readonly companyTripsService: CompanyTripsService,
    private readonly companyCustomersService: CompanyCustomersService,
    private readonly rideService: RideService,
  ) {}

  // ==========================================
  // DISPATCHER DASHBOARD METRICS & TABS
  // ==========================================

  @Get('stats')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({
    summary: 'Dispatcher Dashboard: Get KPI stats & trip counts',
    description:
      'Returns total, scheduled, completed, cancelled, pending, and active trip counts for the dispatcher dashboard.',
  })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Stats fetched successfully' })
  async getDispatcherStats(@Query() query: any, @Req() req: any) {
    return this.companyTripsService.getDispatcherDashboardStats(query, req.user);
  }

  @Get('scheduled-trips')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({
    summary: 'Dispatcher Dashboard: Get Scheduled Trips',
    description:
      'Fetches scheduled trips for future pickup time. Fields: id/tripId, customer, pickup, time/scheduledFor, status: "scheduled".',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Scheduled trips fetched successfully' })
  async getScheduledTrips(@Query() query: any, @Req() req: any) {
    return this.companyTripsService.getScheduledTrips(query, req.user);
  }

  @Get('completed-trips')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({
    summary: 'Dispatcher Dashboard: Get Completed Trips',
    description:
      'Fetches completed trips finished today. Fields: id/tripId, customer, driver, fare, status: "completed".',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Completed trips fetched successfully' })
  async getCompletedTrips(@Query() query: any, @Req() req: any) {
    return this.companyTripsService.getCompletedTrips(query, req.user);
  }

  @Get('cancelled-trips')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({
    summary: 'Dispatcher Dashboard: Get Cancelled Trips',
    description:
      'Fetches cancelled trips by rider or driver. Fields: id/tripId, customer, pickup, status: "cancelled", cancelReason.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Cancelled trips fetched successfully' })
  async getCancelledTrips(@Query() query: any, @Req() req: any) {
    return this.companyTripsService.getCancelledTrips(query, req.user);
  }

  @Get('pending-trips')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({
    summary: 'Dispatcher Dashboard: Get Pending Trips',
    description:
      'Fetches trips awaiting driver dispatch / assignment.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Pending trips fetched successfully' })
  async getPendingTrips(@Query() query: any, @Req() req: any) {
    return this.companyTripsService.getPendingTrips(query, req.user);
  }

  @Get('live-trips')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({
    summary: 'Dispatcher Dashboard: Get Active / Ongoing Live Trips',
    description: 'Real-time active driver trips for dispatcher monitoring.',
  })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Active live trips fetched successfully' })
  async getLiveTrips(@Query() query: any, @Req() req: any) {
    return this.companyTripsService.getCompanyActiveTrips(query, req.user);
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
  @ApiOperation({ summary: 'Dispatcher Dashboard: Live Map of Drivers & Trips' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['All', 'AVAILABLE', 'ON_TRIP', 'OFFLINE'] })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Live map data fetched successfully' })
  async getLiveMap(@Query() query: any, @Req() req: any) {
    return this.companyCustomersService.getCompanyLiveMap(query, req.user);
  }

  // ==========================================
  // DISPATCHER TRIP MANAGEMENT & ACTIONS
  // ==========================================

  @Get('trips')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Dispatcher: Get all trips with filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: CompanyTripStatusFilter })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'companyId', required: false, type: String })
  async getAllTrips(@Query() query: GetCompanyTripsQueryDto, @Req() req: any) {
    return this.companyTripsService.getCompanyTrips(query, req.user);
  }

  @Get('trips/:id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Dispatcher: Get trip details by ID' })
  @ApiParam({ name: 'id', description: 'Trip / Ride ID' })
  async getTripById(@Param('id') id: string, @Req() req: any) {
    return this.companyTripsService.getCompanyTripById(id, req.user);
  }

  @Post('book-trip')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({
    summary: 'Dispatcher: Create a booking on behalf of customer or guest',
    description: 'Book ride directly from dispatcher console with optional immediate driver assignment.',
  })
  async bookTrip(@Req() req: any, @Body() dto: CreateDispatcherBookingDto) {
    return this.rideService.bookDispatcherRide(req.user, dto);
  }

  @Patch('trips/:id/modify')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Dispatcher: Modify trip details (pickup, dropoff, schedule, driver)' })
  @ApiParam({ name: 'id', description: 'Trip / Ride ID' })
  async modifyTrip(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ModifyRideDto,
  ) {
    return this.rideService.modifyRide(req.user, id, dto);
  }

  @Post('trips/:id/assign-driver')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Dispatcher: Manually assign driver to trip' })
  @ApiParam({ name: 'id', description: 'Trip / Ride ID' })
  async manualAssignDriver(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AssignDriverDto,
  ) {
    return this.companyTripsService.manualAssignDriver(id, dto.driverId, req.user);
  }

  @Post('trips/:id/auto-assign')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Dispatcher: Auto-assign best available driver to trip' })
  @ApiParam({ name: 'id', description: 'Trip / Ride ID' })
  async autoAssignDriver(@Req() req: any, @Param('id') id: string) {
    return this.companyTripsService.autoAssignDriver(id, req.user);
  }

  @Post('trips/:id/cancel')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Dispatcher: Cancel booking' })
  @ApiParam({ name: 'id', description: 'Trip / Ride ID' })
  async cancelTrip(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CancelTripDto,
  ) {
    return this.companyTripsService.cancelCompanyTrip(id, dto?.cancelReason, req.user);
  }

  @Delete('trips/:id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(
    UserRole.COMPANY_ADMIN,
    ...COMPANY_STAFF_ROLES,
    UserRole.ADMIN,
    UserRole.SUPERADMIN,
  )
  @ApiOperation({ summary: 'Dispatcher: Delete booking record' })
  @ApiParam({ name: 'id', description: 'Trip / Ride ID' })
  async deleteTrip(@Req() req: any, @Param('id') id: string) {
    return this.companyTripsService.deleteCompanyTrip(id, req.user);
  }
}
