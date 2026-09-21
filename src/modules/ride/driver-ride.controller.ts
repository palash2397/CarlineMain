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

import { DriverRideService } from './driver-ride.service';
import { DRIVER_RIDE_SECTION } from './ride.constants';

import { DriverCancelRideDto } from './dto/driver-cancel-ride.dto';
import { DriverCollectPaymentDto } from './dto/driver-collect-payment.dto';
import { DriverDutyDto } from './dto/driver-duty.dto';
import { DriverEarningsQueryDto } from './dto/driver-earnings-query.dto';
import { DriverLocationDto } from './dto/driver-location.dto';
import { DriverRideHistoryQueryDto } from './dto/driver-ride-history-query.dto';
import { DriverRideIdDto } from './dto/driver-ride-id.dto';
import { DriverStartRideDto } from './dto/driver-start-ride.dto';

@ApiTags(DRIVER_RIDE_SECTION)
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(UserRole.DRIVER)
@Controller('driver-ride')
export class DriverRideController {
  constructor(private readonly driverRideService: DriverRideService) {}

  @Get('/home')
  @ApiOperation({
    summary:
      'Driver home - profile, duty status, active vehicle, today stats and running ride',
  })
  async home(@Req() req: any) {
    return this.driverRideService.home(req.user.id);
  }

  @Patch('/duty')
  @ApiOperation({ summary: 'Go online / Go offline toggle of the driver home' })
  async setDuty(@Req() req: any, @Body() dto: DriverDutyDto) {
    return this.driverRideService.setDuty(req.user.id, dto);
  }

  @Post('/location')
  @ApiOperation({
    summary:
      'Push the driver live location over REST (socket driverLocation event ka REST fallback)',
  })
  async updateLocation(@Req() req: any, @Body() dto: DriverLocationDto) {
    return this.driverRideService.updateLocation(req.user.id, dto);
  }

  @Get('/requests')
  @ApiOperation({
    summary:
      'Live ride requests for the driver vehicle type (New Ride Request screen list)',
  })
  async requests(@Req() req: any) {
    return this.driverRideService.requests(req.user.id);
  }

  @Get('/requests/:id')
  @ApiOperation({
    summary:
      'Single ride request card - passenger, distance to pickup, fare and ETA',
  })
  @ApiParam({ name: 'id', description: 'Ride id of the request' })
  async requestDetails(@Req() req: any, @Param('id') rideId: string) {
    return this.driverRideService.requestDetails(req.user.id, rideId);
  }

  @Post('/accept')
  @ApiOperation({ summary: 'Accept a ride request (Slide to Accept)' })
  async accept(@Req() req: any, @Body() dto: DriverRideIdDto) {
    return this.driverRideService.accept(req.user.id, dto);
  }

  @Patch('/arrived')
  @ApiOperation({ summary: 'Driver reached the pickup point (Waiting for Rider)' })
  async arrived(@Req() req: any, @Body() dto: DriverRideIdDto) {
    return this.driverRideService.arrived(req.user.id, dto);
  }

  @Post('/start')
  @ApiOperation({
    summary: 'Start the trip (Start Trip) - optional passenger OTP verify hota hai',
  })
  async start(@Req() req: any, @Body() dto: DriverStartRideDto) {
    return this.driverRideService.start(req.user.id, dto);
  }
  @Post('/complete')
  @ApiOperation({
    summary: 'End the trip (End Trip) - fare final ho jata hai aur ride complete',
  })
  async complete(@Req() req: any, @Body() dto: DriverRideIdDto) {
    return this.driverRideService.complete(req.user.id, dto);
  }

  @Post('/collect-payment')
  @ApiOperation({
    summary: 'Collect Payment on the fare screen (cash rides ko PAID mark karta hai)',
  })
  async collectPayment(@Req() req: any, @Body() dto: DriverCollectPaymentDto) {
    return this.driverRideService.collectPayment(req.user.id, dto);
  }

  @Patch('/cancel')
  @ApiOperation({ summary: 'Driver cancels the ride before the trip starts' })
  async cancelRide(@Req() req: any, @Body() dto: DriverCancelRideDto) {
    return this.driverRideService.cancelRide(req.user.id, dto);
  }

  @Get('/active')
  @ApiOperation({
    summary: 'Running ride of the driver, null when there is none',
  })
  async activeRide(@Req() req: any) {
    return this.driverRideService.activeRide(req.user.id);
  }

  @Get('/history')
  @ApiOperation({ summary: 'Trips tab - ride history of the driver' })
  async history(@Req() req: any, @Query() query: DriverRideHistoryQueryDto) {
    return this.driverRideService.history(req.user.id, query);
  }

  @Get('/rides/:id')
  @ApiOperation({ summary: 'One ride of the driver with full details' })
  @ApiParam({ name: 'id', description: 'Ride id' })
  async rideDetails(@Req() req: any, @Param('id') rideId: string) {
    return this.driverRideService.rideDetails(req.user.id, rideId);
  }

  @Get('/earnings')
  @ApiOperation({
    summary: 'Earnings tab - today, week, month and daily earning breakdown',
  })
  async earnings(@Req() req: any, @Query() query: DriverEarningsQueryDto) {
    return this.driverRideService.earnings(req.user.id, query);
  }
}
