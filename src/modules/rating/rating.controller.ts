import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { RatingService } from './rating.service';

import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';

import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole } from 'src/common/enums/user/role.enum';

import { CreateRatingDto } from './dto/create-rating.dto';

@ApiTags('Rating (by Prakash)')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('rating')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Post('/submit')
  @Roles(UserRole.USER, UserRole.PASSENGER)
  @UseGuards(RoleGuard)
  @ApiOperation({
    summary:
      'Point 15: Customer rating - Passenger rates Driver after trip completion',
    description:
      'Allows the passenger to submit a 1 to 5 star rating and review for the driver of a completed ride.',
  })
  submitRating(@Req() req: any, @Body() dto: CreateRatingDto) {
    return this.ratingService.createRating(req.user.id, dto);
  }

  @Get('/ride/:rideId')
  @Roles(
    UserRole.USER,
    UserRole.PASSENGER,
    UserRole.DRIVER,
    UserRole.SUPERADMIN,
    UserRole.ADMIN,
    UserRole.COMPANY_ADMIN,
  )
  @UseGuards(RoleGuard)
  @ApiOperation({
    summary: 'Get rating details for a completed ride',
    description: 'Returns the rating and review given for a specific ride.',
  })
  @ApiParam({ name: 'rideId', example: '66fb2475ab083c261e1b19a1' })
  getRideRating(@Param('rideId') rideId: string) {
    return this.ratingService.getRideRating(rideId);
  }

  @Get('/driver/:driverId')
  @Roles(
    UserRole.USER,
    UserRole.PASSENGER,
    UserRole.DRIVER,
    UserRole.SUPERADMIN,
    UserRole.ADMIN,
    UserRole.COMPANY_ADMIN,
    UserRole.DISPATCHER,
  )
  @UseGuards(RoleGuard)
  @ApiOperation({
    summary: 'Get all reviews and ratings breakdown for a driver',
    description:
      'Returns aggregate average rating, star breakdown (5, 4, 3, 2, 1 stars), and paginated reviews.',
  })
  @ApiParam({ name: 'driverId', example: '66fb1000ab083c261e1b1900' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  getDriverReviews(
    @Param('driverId') driverId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ratingService.getDriverReviews(
      driverId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  @Get('/my')
  @Roles(UserRole.USER, UserRole.PASSENGER)
  @UseGuards(RoleGuard)
  @ApiOperation({
    summary: 'Get all ratings submitted by the current passenger',
    description:
      'Returns all reviews and ratings submitted by the logged in user.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  myReviews(
    @Req() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ratingService.myReviews(
      req.user.id,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }
}
