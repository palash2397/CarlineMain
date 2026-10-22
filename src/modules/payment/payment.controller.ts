import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
  ApiTags,
} from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { UserRole } from 'src/common/enums/user/role.enum';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { RoleGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';

import { PaymentService } from './payment.service';
import { AddCardDto } from './dto/add-card.dto';
import { ChargeRideDto, RefundTransactionDto, PaymentQueryDto } from './dto/payment.dto';

import { Ride } from '../ride/schema/ride.schema';

const PASSENGER_ROLES = [UserRole.USER, UserRole.PASSENGER];
const ADMIN_ROLES = [UserRole.SUPERADMIN, UserRole.ADMIN];

@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    @InjectModel(Ride.name) private readonly rideModel: Model<any>,
  ) {}

  // ============================================================
  // CARD MANAGEMENT
  // ============================================================

  @ApiTags('User Payment')
  @ApiOperation({
    summary: 'Add / tokenize a card',
    description:
      'Tokenizes the card via USAePay customer vault. Raw card number is never stored in our database.',
  })
  @Roles(...PASSENGER_ROLES)
  @HttpCode(HttpStatus.OK)
  @Post('card/add')
  addCard(@Req() req: any, @Body() dto: AddCardDto) {
    return this.paymentService.addCard(req.user.id, dto);
  }

  @ApiTags('User Payment')
  @ApiOperation({ summary: 'List saved cards for the current customer' })
  @Roles(...PASSENGER_ROLES)
  @Get('card/list')
  listCards(@Req() req: any) {
    return this.paymentService.listCards(req.user.id);
  }

  @ApiTags('User Payment')
  @ApiOperation({ summary: 'Delete a saved card by payMethodKey' })
  @ApiParam({ name: 'payMethodKey', description: 'USAePay payment method key' })
  @Roles(...PASSENGER_ROLES)
  @Delete('card/:payMethodKey')
  deleteCard(@Req() req: any, @Param('payMethodKey') payMethodKey: string) {
    return this.paymentService.deleteCard(req.user.id, payMethodKey);
  }

  // ============================================================
  // RIDE PAYMENT
  // ============================================================

  @ApiTags('User Payment')
  @ApiOperation({
    summary: 'Charge a ride payment',
    description:
      'Charges the customer for a completed ride. For CARD rides uses USAePay saved card. For CASH rides records the payment directly.',
  })
  @Roles(...PASSENGER_ROLES)
  @HttpCode(HttpStatus.OK)
  @Post('ride/charge')
  chargeRide(@Req() req: any, @Body() dto: ChargeRideDto) {
    return this.paymentService.chargeRide(req.user.id, dto, this.rideModel);
  }

  // ============================================================
  // REFUND
  // ============================================================

  @ApiTags('User Payment')
  @ApiOperation({
    summary: 'Refund a transaction',
    description:
      'Full or partial refund. Only SUCCESS transactions can be refunded. CASH transactions cannot be refunded via gateway.',
  })
  @Roles(...PASSENGER_ROLES, ...ADMIN_ROLES)
  @HttpCode(HttpStatus.OK)
  @Post('refund')
  refundTransaction(@Req() req: any, @Body() dto: RefundTransactionDto) {
    return this.paymentService.refundTransaction(req.user.id, dto);
  }

  // ============================================================
  // TRANSACTION HISTORY
  // ============================================================

  @ApiTags('User Payment')
  @ApiOperation({ summary: 'Get my payment transaction history' })
  @Roles(...PASSENGER_ROLES)
  @Get('transactions')
  myTransactions(@Req() req: any, @Query() query: PaymentQueryDto) {
    return this.paymentService.myTransactions(req.user.id, query);
  }

  @ApiTags('User Payment')
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @Roles(...PASSENGER_ROLES)
  @Get('transactions/:id')
  getTransaction(@Req() req: any, @Param('id') id: string) {
    return this.paymentService.getTransaction(req.user.id, id);
  }

  // ============================================================
  // ADMIN: All Transactions
  // ============================================================

  @ApiTags('Admin Payment')
  @ApiOperation({ summary: 'Get all payment transactions (Superadmin/Admin only)' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'rideId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @Roles(...ADMIN_ROLES)
  @Get('admin/transactions')
  allTransactions(@Query() query: any) {
    return this.paymentService.allTransactions(query);
  }
}
