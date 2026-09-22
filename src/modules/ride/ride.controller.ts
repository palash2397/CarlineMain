import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { UserRole } from 'src/common/enums/user/role.enum';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';

import { BookRideDto } from './dto/book-ride.dto';
import { CancelRideDto } from './dto/cancel-ride.dto';
import { EstimateFareDto } from './dto/estimate-fare.dto';
import { MyRidesQueryDto } from './dto/my-rides-query.dto';
import { NearbyCabsDto } from './dto/nearby-cabs.dto';

import { DriverCancelRideDto } from './dto/driver-cancel-ride.dto';
import { DriverCollectPaymentDto } from './dto/driver-collect-payment.dto';
import { DriverDutyDto } from './dto/driver-duty.dto';
import { DriverEarningsQueryDto } from './dto/driver-earnings-query.dto';
import { DriverLocationDto } from './dto/driver-location.dto';
import { DriverRideHistoryQueryDto } from './dto/driver-ride-history-query.dto';
import { DriverRideIdDto } from './dto/driver-ride-id.dto';
import { DriverStartRideDto } from './dto/driver-start-ride.dto';

import { RideService } from './ride.service';

const PASSENGER_ROLES = [UserRole.USER, UserRole.PASSENGER];
const PASSENGER_TAG = 'User Booking (by Prakash)';
const DRIVER_TAG = 'Driver Booking (by Prakash)';

// Passenger booking flow + driver booking flow. Both prefixes are kept
// (/ride/* and /driver-ride/*) so the apps keep the same URLs, role wise
// access is decided per route with @Roles.
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller()
export class RideController {
  constructor(private readonly rideService: RideService) {}

  // ==========================================================
  // Passenger side - /ride/*
  // ==========================================================
  @Get('ride/vehicle-types')
  @ApiTags(PASSENGER_TAG)
  @Roles(...PASSENGER_ROLES)
  @ApiOperation({
    summary: 'Active vehicle list for the booking screen (class, seats, image, price rates)',
  })
  async listVehicleTypes() {
    return this.rideService.listVehicleTypes();
  }

  @Get('ride/promo-codes')
  @ApiTags(PASSENGER_TAG)
  @Roles(...PASSENGER_ROLES)
  @ApiOperation({ summary: 'Active promo codes for the Have a Promo Code popup' })
  async promoCodes() {
    return this.rideService.promoCodes();
  }

  @Post('ride/estimate-fare')
  @ApiTags(PASSENGER_TAG)
  @Roles(...PASSENGER_ROLES)
  @ApiOperation({
    summary: 'Upfront fare, distance and ETA for every vehicle type of a route',
  })
  async estimateFare(@Req() req: any, @Body() dto: EstimateFareDto) {
    return this.rideService.estimateFare(req.user, dto);
  }

  @Post('ride/book')
  @ApiTags(PASSENGER_TAG)
  @Roles(...PASSENGER_ROLES)
  @ApiOperation({ summary: 'Confirm and book the ride (instant or scheduled)' })
  async bookRide(@Req() req: any, @Body() dto: BookRideDto) {
    return this.rideService.bookRide(req.user, dto);
  }

  @Get('ride/my')
  @ApiTags(PASSENGER_TAG)
  @Roles(...PASSENGER_ROLES)
  @ApiOperation({ summary: 'Ride activity of the logged in passenger' })
  async myRides(@Req() req: any, @Query() query: MyRidesQueryDto) {
    return this.rideService.myRides(req.user, query);
  }

  @Get('ride/active')
  @ApiTags(PASSENGER_TAG)
  @Roles(...PASSENGER_ROLES)
  @ApiOperation({ summary: 'Current live ride of the passenger, null when there is none' })
  async activeRide(@Req() req: any) {
    return this.rideService.activeRide(req.user);
  }

  @Get('ride/nearby-cabs')
  @ApiTags(PASSENGER_TAG)
  @Roles(...PASSENGER_ROLES)
  @ApiOperation({ summary: 'Online cabs around the pickup point (8 Cabs Nearby badge)' })
  async nearbyCabs(@Req() req: any, @Query() query: NearbyCabsDto) {
    return this.rideService.nearbyCabs(req.user, query);
  }

  @Patch('ride/cancel')
  @ApiTags(PASSENGER_TAG)
  @Roles(...PASSENGER_ROLES)
  @ApiOperation({ summary: 'Cancel a booked ride' })
  async cancelRide(@Req() req: any, @Body() dto: CancelRideDto) {
    return this.rideService.cancelRide(req.user, dto);
  }

  @Get('ride/:id')
  @ApiTags(PASSENGER_TAG)
  @Roles(...PASSENGER_ROLES)
  @ApiOperation({
    summary: 'Ride tracking details - status, driver, live ETA and fare',
  })
  @ApiParam({ name: 'id', description: 'Ride id' })
  async rideDetails(@Req() req: any, @Param('id') rideId: string) {
    return this.rideService.rideDetails(req.user, rideId);
  }

  // ==========================================================
  // Driver side - /driver-ride/*
  // ==========================================================
  @Get('driver-ride/home')
  @ApiTags(DRIVER_TAG)
  @Roles(UserRole.DRIVER)
  @ApiOperation({
    summary:
      'Driver home - profile, duty status, active vehicle, today stats and running ride',
  })
  async home(@Req() req: any) {
    return this.rideService.home(req.user.id);
  }

  @Patch('driver-ride/duty')
  @ApiTags(DRIVER_TAG)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Go online / Go offline toggle of the driver home' })
  async setDuty(@Req() req: any, @Body() dto: DriverDutyDto) {
    return this.rideService.setDuty(req.user.id, dto);
  }

  @Post('driver-ride/location')
  @ApiTags(DRIVER_TAG)
  @Roles(UserRole.DRIVER)
  @ApiOperation({
    summary:
      'Push the driver live location over REST (REST fallback for the socket driverLocation event)',
  })
  async updateLocation(@Req() req: any, @Body() dto: DriverLocationDto) {
    return this.rideService.updateLocation(req.user.id, dto);
  }

  @Get('driver-ride/requests')
  @ApiTags(DRIVER_TAG)
  @Roles(UserRole.DRIVER)
  @ApiOperation({
    summary:
      'Live ride requests for the driver vehicle type (New Ride Request screen list)',
  })
  async requests(@Req() req: any) {
    return this.rideService.requests(req.user.id);
  }

  @Get('driver-ride/requests/:id')
  @ApiTags(DRIVER_TAG)
  @Roles(UserRole.DRIVER)
  @ApiOperation({
    summary:
      'Single ride request card - passenger, distance to pickup, fare and ETA',
  })
  @ApiParam({ name: 'id', description: 'Ride id of the request' })
  async requestDetails(@Req() req: any, @Param('id') rideId: string) {
    return this.rideService.requestDetails(req.user.id, rideId);
  }

  @Post('driver-ride/accept')
  @ApiTags(DRIVER_TAG)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Accept a ride request (Slide to Accept)' })
  async accept(@Req() req: any, @Body() dto: DriverRideIdDto) {
    return this.rideService.accept(req.user.id, dto);
  }

  @Patch('driver-ride/arrived')
  @ApiTags(DRIVER_TAG)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver reached the pickup point (Waiting for Rider)' })
  async arrived(@Req() req: any, @Body() dto: DriverRideIdDto) {
    return this.rideService.arrived(req.user.id, dto);
  }

  @Post('driver-ride/start')
  @ApiTags(DRIVER_TAG)
  @Roles(UserRole.DRIVER)
  @ApiOperation({
    summary: 'Start the trip (Start Trip) - passenger OTP is verified when sent',
  })
  async start(@Req() req: any, @Body() dto: DriverStartRideDto) {
    return this.rideService.start(req.user.id, dto);
  }

  @Post('driver-ride/complete')
  @ApiTags(DRIVER_TAG)
  @Roles(UserRole.DRIVER)
  @ApiOperation({
    summary: 'End the trip (End Trip) - the fare is finalized and the ride completes',
  })
  async complete(@Req() req: any, @Body() dto: DriverRideIdDto) {
    return this.rideService.complete(req.user.id, dto);
  }

  @Post('driver-ride/collect-payment')
  @ApiTags(DRIVER_TAG)
  @Roles(UserRole.DRIVER)
  @ApiOperation({
    summary: 'Collect payment on the fare screen (marks cash rides as PAID)',
  })
  async collectPayment(@Req() req: any, @Body() dto: DriverCollectPaymentDto) {
    return this.rideService.collectPayment(req.user.id, dto);
  }

  @Patch('driver-ride/cancel')
  @ApiTags(DRIVER_TAG)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver cancels the ride before the trip starts' })
  async driverCancelRide(@Req() req: any, @Body() dto: DriverCancelRideDto) {
    return this.rideService.driverCancelRide(req.user.id, dto);
  }

  @Get('driver-ride/active')
  @ApiTags(DRIVER_TAG)
  @Roles(UserRole.DRIVER)
  @ApiOperation({
    summary: 'Running ride of the driver, null when there is none',
  })
  async driverActiveRide(@Req() req: any) {
    return this.rideService.driverActiveRide(req.user.id);
  }

  @Get('driver-ride/history')
  @ApiTags(DRIVER_TAG)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Trips tab - ride history of the driver' })
  async history(@Req() req: any, @Query() query: DriverRideHistoryQueryDto) {
    return this.rideService.history(req.user.id, query);
  }

  @Get('driver-ride/rides/:id')
  @ApiTags(DRIVER_TAG)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'One ride of the driver with full details' })
  @ApiParam({ name: 'id', description: 'Ride id' })
  async driverRideDetails(@Req() req: any, @Param('id') rideId: string) {
    return this.rideService.driverRideDetails(req.user.id, rideId);
  }

  @Get('driver-ride/earnings')
  @ApiTags(DRIVER_TAG)
  @Roles(UserRole.DRIVER)
  @ApiOperation({
    summary: 'Earnings tab - today, week, month and daily earning breakdown',
  })
  async earnings(@Req() req: any, @Query() query: DriverEarningsQueryDto) {
    return this.rideService.earnings(req.user.id, query);
  }
}
