import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
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
import {
  CreatePayoutRequestDto,
  ApprovePayoutDto,
  RejectPayoutDto,
  GetPayoutsQueryDto,
} from './dto/payout.dto';
import {
  TopUpWalletDto,
  PayRideWithWalletDto,
  WalletHistoryQueryDto,
} from './dto/wallet.dto';

import { Ride } from '../ride/schema/ride.schema';

const PASSENGER_ROLES = [UserRole.USER, UserRole.PASSENGER];
const ADMIN_ROLES = [UserRole.SUPERADMIN, UserRole.ADMIN];
const COMPANY_PAYOUT_ROLES = [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY_ADMIN,
  UserRole.ACCOUNTANT,
  UserRole.ACCOUNTING,
  UserRole.BILLING,
];

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
  // PASSENGER WALLET & SPLIT PAYMENT
  // ============================================================

  @ApiTags('User Payment')
  @ApiOperation({
    summary: 'Recharge passenger wallet via saved card',
    description:
      'Charges the specified saved card on USAePay and credits the amount to the passenger wallet. Recharged wallet funds are non-withdrawable ride credits.',
  })
  @Roles(...PASSENGER_ROLES)
  @Post('wallet/topup')
  async topUpWallet(
    @Req() req: any,
    @Body() dto: TopUpWalletDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.paymentService.topUpWallet(req.user.id, dto);
    if (result?.statusCode) {
      res.status(result.statusCode);
    }
    return result;
  }

  @ApiTags('User Payment')
  @ApiOperation({
    summary: 'Get passenger wallet balance and history',
    description:
      'Returns current non-withdrawable wallet balance, totals recharged and spent, and paginated transaction passbook.',
  })
  @Roles(...PASSENGER_ROLES)
  @Get('wallet')
  async getWalletDetails(
    @Req() req: any,
    @Query() query: WalletHistoryQueryDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.paymentService.getWalletDetails(req.user.id, query);
    if (result?.statusCode) {
      res.status(result.statusCode);
    }
    return result;
  }

  @ApiTags('User Payment')
  @ApiOperation({
    summary: 'Pay ride fare from passenger wallet (Full or Split with Cash/Card)',
    description:
      'Deducts available balance from passenger wallet. If wallet has full fare, marks ride PAID. If wallet has partial balance (e.g. $100 of $120), deducts $100 from wallet and marks remaining $20 as pending for driver cash collection or immediate card charge.',
  })
  @Roles(...PASSENGER_ROLES)
  @Post('ride/pay-with-wallet')
  async payRideWithWallet(
    @Req() req: any,
    @Body() dto: PayRideWithWalletDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.paymentService.payRideWithWallet(req.user.id, dto);
    if (result?.statusCode) {
      res.status(result.statusCode);
    }
    return result;
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
  // DRIVER: Transaction History
  // ============================================================

  @ApiTags('Driver Payment')
  @ApiOperation({
    summary: 'Get driver payment transaction history (Wallet & Statements)',
    description:
      'Driver portal transactions view according to UI: Returns 3 summary cards (TOTAL INFLOWS, TOTAL PAYOUTS, NET BALANCE), tabs (ALL, EARNINGS, PAYOUTS), and transactions table with formatted date, description, amount, method, and status.',
  })
  @ApiQuery({ name: 'tab', required: false, enum: ['ALL', 'EARNINGS', 'PAYOUTS'], description: 'Filter by tab: ALL, EARNINGS, or PAYOUTS' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status: Completed, Pending, Failed' })
  @ApiQuery({ name: 'paymentMethod', required: false, description: 'Filter by payment method: Cash, Card, UPI, Wallet' })
  @Roles(UserRole.DRIVER)
  @Get('driver/transactions')
  driverTransactions(@Req() req: any, @Query() query: any) {
    return this.paymentService.driverTransactions(req.user.id, query);
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

  // ============================================================
  // DRIVER FINANCIAL MANAGEMENT: PAYOUTS
  // ============================================================

  @ApiTags('Driver Financial Management')
  @ApiOperation({
    summary: 'Submit a payout / withdrawal request',
    description:
      'Driver requests a payout from their available net balance. Validates that requested amount does not exceed available balance.',
  })
  @Roles(UserRole.DRIVER)
  @Post('driver/payout-request')
  async requestPayout(
    @Req() req: any,
    @Body() dto: CreatePayoutRequestDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.paymentService.requestPayout(req.user.id, dto);
    if (result?.statusCode) {
      res.status(result.statusCode);
    }
    return result;
  }

  @ApiTags('Driver Financial Management')
  @ApiOperation({
    summary: 'Get driver payout requests history and statistics',
    description: 'Lists all payout requests made by the logged-in driver with status filtering and totals.',
  })
  @Roles(UserRole.DRIVER)
  @Get('driver/payouts')
  async getDriverPayouts(
    @Req() req: any,
    @Query() query: GetPayoutsQueryDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.paymentService.getDriverPayouts(req.user.id, query);
    if (result?.statusCode) {
      res.status(result.statusCode);
    }
    return result;
  }

  @ApiTags('Driver Financial Management')
  @ApiOperation({ summary: 'Get single payout request details' })
  @ApiParam({ name: 'id', description: 'Payout request ID' })
  @Roles(UserRole.DRIVER)
  @Get('driver/payouts/:id')
  async getDriverPayoutById(
    @Req() req: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.paymentService.getPayoutById(id, req.user.id);
    if (result?.statusCode) {
      res.status(result.statusCode);
    }
    return result;
  }

  // ============================================================
  // COMPANY & ADMIN: PAYOUT APPROVALS & MANAGEMENT
  // ============================================================

  @ApiTags('Company Financial Management')
  @ApiOperation({
    summary: 'List company driver payout requests',
    description: 'Allows Company Admin or Superadmin to view driver payout requests awaiting approval.',
  })
  @Roles(...COMPANY_PAYOUT_ROLES)
  @Get('company/payouts')
  async getCompanyPayouts(
    @Req() req: any,
    @Query() query: GetPayoutsQueryDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.paymentService.getCompanyPayouts(req.user, query);
    if (result?.statusCode) {
      res.status(result.statusCode);
    }
    return result;
  }

  @ApiTags('Company Financial Management')
  @ApiOperation({ summary: 'Get payout request details (Admin / Company Admin)' })
  @ApiParam({ name: 'id', description: 'Payout request ID' })
  @Roles(...COMPANY_PAYOUT_ROLES)
  @Get('company/payouts/:id')
  async getCompanyPayoutById(
    @Req() req: any,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.paymentService.getPayoutById(id, req.user.companyId);
    if (result?.statusCode) {
      res.status(result.statusCode);
    }
    return result;
  }

  @ApiTags('Company Financial Management')
  @ApiOperation({
    summary: 'Approve driver payout request',
    description:
      'Approves a PENDING payout request. Automatically records an OUTFLOW transaction in PaymentTransaction and deducts from Driver Net Balance.',
  })
  @ApiParam({ name: 'id', description: 'Payout request ID' })
  @Roles(...COMPANY_PAYOUT_ROLES)
  @Patch('company/payouts/:id/approve')
  async approvePayout(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ApprovePayoutDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.paymentService.approvePayout(req.user, id, dto);
    if (result?.statusCode) {
      res.status(result.statusCode);
    }
    return result;
  }

  @ApiTags('Company Financial Management')
  @ApiOperation({
    summary: 'Reject driver payout request',
    description: 'Rejects a PENDING payout request with a mandatory rejection reason, releasing the hold on driver balance.',
  })
  @ApiParam({ name: 'id', description: 'Payout request ID' })
  @Roles(...COMPANY_PAYOUT_ROLES)
  @Patch('company/payouts/:id/reject')
  async rejectPayout(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: RejectPayoutDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const result = await this.paymentService.rejectPayout(req.user, id, dto);
    if (result?.statusCode) {
      res.status(result.statusCode);
    }
    return result;
  }
}
