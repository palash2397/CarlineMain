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
import { RideService } from './ride.service';

const PASSENGER_ROLES = [UserRole.USER, UserRole.PASSENGER];

@ApiTags('User Booking')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(...PASSENGER_ROLES)
@Controller('ride')
export class RideController {
  constructor(private readonly rideService: RideService) {}

  @Get('/vehicle-types')
  @ApiOperation({
    summary: 'Active vehicle list for the booking screen (class, seats, image, price rates)',
  })
  async listVehicleTypes() {
    return this.rideService.listVehicleTypes();
  }

  @Get('/promo-codes')
  @ApiOperation({ summary: 'Active promo codes for the Have a Promo Code popup' })
  async promoCodes() {
    return this.rideService.promoCodes();
  }

  @Post('/estimate-fare')
  @ApiOperation({
    summary: 'Upfront fare, distance and ETA for every vehicle type of a route',
  })
  async estimateFare(@Req() req: any, @Body() dto: EstimateFareDto) {
    return this.rideService.estimateFare(req.user, dto);
  }

  @Post('/book')
  @ApiOperation({ summary: 'Confirm and book the ride (instant or scheduled)' })
  async bookRide(@Req() req: any, @Body() dto: BookRideDto) {
    return this.rideService.bookRide(req.user, dto);
  }

  @Get('/my')
  @ApiOperation({ summary: 'Ride activity of the logged in passenger' })
  async myRides(@Req() req: any, @Query() query: MyRidesQueryDto) {
    return this.rideService.myRides(req.user, query);
  }

  @Get('/active')
  @ApiOperation({ summary: 'Current live ride of the passenger, null when there is none' })
  async activeRide(@Req() req: any) {
    return this.rideService.activeRide(req.user);
  }

  @Get('/nearby-cabs')
  @ApiOperation({ summary: 'Online cabs around the pickup point (8 Cabs Nearby badge)' })
  async nearbyCabs(@Req() req: any, @Query() query: NearbyCabsDto) {
    return this.rideService.nearbyCabs(req.user, query);
  }

  @Patch('/cancel')
  @ApiOperation({ summary: 'Cancel a booked ride' })
  async cancelRide(@Req() req: any, @Body() dto: CancelRideDto) {
    return this.rideService.cancelRide(req.user, dto);
  }

  @Get('/:id')
  @ApiOperation({
    summary: 'Ride tracking details - status, driver, live ETA and fare',
  })
  @ApiParam({ name: 'id', description: 'Ride id' })
  async rideDetails(@Req() req: any, @Param('id') rideId: string) {
    return this.rideService.rideDetails(req.user, rideId);
  }
}
