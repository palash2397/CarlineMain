import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { SocketService } from '../socket/socket.service';

import { ApiResponse } from 'src/helpers/ApiResponse';
import { Msg } from 'src/helpers/responseMsg';

import { PaymentMethod } from 'src/common/enums/ride/payment-method.enum';
import { PaymentStatus } from 'src/common/enums/ride/payment-status.enum';
import { PaymentTransactionStatus } from 'src/common/enums/payment/payment-transaction-status.enum';
import { PayoutStatus } from 'src/common/enums/payment/payout-status.enum';

import {
  PaymentTransaction,
  PaymentTransactionDocument,
  CommissionSnapshot,
} from './schema/payment-transaction.schema';
import { Payout, PayoutDocument } from './schema/payout.schema';

import { Customer, CustomerDocument } from '../customer/schema/customer.schema';
import { Ride, RideDocument } from '../ride/schema/ride.schema';
import { Driver, DriverDocument } from '../driver/schema/driver.schema';
import { User, UserDocument } from '../user/schema/user.schema';
import { RideStatus } from 'src/common/enums/ride/ride-status.enum';

import { UsaepayService } from './usaepay.service';
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

// Ride document shape (minimal fields we need)
interface RideDoc {
  _id: any;
  user: string;
  driver?: string | null;
  companyId?: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  payableFare: number;
  totalFare: number;
  status: string;
  commissionBreakdown?: any;
  driverEarnings?: number;
  companyCommissionAmount?: number;
  superAdminCommissionAmount?: number;
  companyEarnings?: number;
}

/**
 * PaymentService handles:
 * - Card tokenization (add/list/delete saved cards via USAePay vault)
 * - Charging rides (saved card or cash)
 * - Refunds / Voids
 * - Transaction history
 *
 * Commission logic is already handled by ride.service.ts via commission.helper.ts.
 * This service snapshots commission data into the transaction record.
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectModel(PaymentTransaction.name)
    private readonly txModel: Model<PaymentTransactionDocument>,

    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,

    @InjectModel(Ride.name)
    private readonly rideModel: Model<RideDocument>,

    @InjectModel(Payout.name)
    private readonly payoutModel: Model<PayoutDocument>,

    @InjectModel(Driver.name)
    private readonly driverModel: Model<DriverDocument>,

    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,

    private readonly usaepay: UsaepayService,
    private readonly config: ConfigService,
    @Optional()
    private readonly socketService?: SocketService,
  ) {}

  // ============================================================
  // CARD MANAGEMENT
  // ============================================================

  /**
   * Add (tokenize) a card for a customer via USAePay customer vault.
   * The raw card number is never stored in our DB — only the vault token.
   */
  async addCard(userId: string, dto: AddCardDto) {
    try {
      // Find customer record linked to this user
      const customer = await this.findOrCreateCustomerVault(userId);

      if (!customer) {
        return new ApiResponse(404, {}, 'Customer profile not found');
      }

      // Tokenize card in USAePay
      const result = await this.usaepay.addCardToCustomer(
        customer.usaepayCustomerId!,
        {
          cardNumber: dto.cardNumber,
          cardExpiration: dto.cardExpiration,
          cardCode: dto.cardCode,
          billingName: dto.billingName,
          billingAddress: dto.billingAddress,
          billingCity: dto.billingCity,
          billingState: dto.billingState,
          billingZip: dto.billingZip,
          billingCountry: dto.billingCountry || 'US',
        },
      );

      if (!result.success) {
        this.logger.error(`addCard failed for userId=${userId}: ${result.error}`);
        return new ApiResponse(400, {}, result.error || 'Failed to add card');
      }

      // Update customer record with latest card info (for quick display)
      const newCardEntry = {
        payMethodKey: result.payMethodKey,
        cardLast4: result.cardLast4,
        cardBrand: result.cardBrand,
        cardExpiration: dto.cardExpiration,
        isDefault: true,
        createdAt: new Date(),
      };

      await this.customerModel.updateOne(
        { _id: customer._id },
        {
          $set: {
            cardLast4: result.cardLast4,
            cardBrand: result.cardBrand,
            defaultPayMethodKey: result.payMethodKey,
          },
          $push: {
            savedCards: newCardEntry,
          },
        },
      );

      return new ApiResponse(
        200,
        {
          payMethodKey: result.payMethodKey,
          cardLast4: result.cardLast4,
          cardBrand: result.cardBrand,
          customerKey: customer.usaepayCustomerId,
        },
        'Card added successfully',
      );
    } catch (error: any) {
      this.logger.error(`addCard error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * List saved cards for a customer.
   */
  async listCards(userId: string) {
    try {
      const customer: any = await this.customerModel
        .findOne({
          $or: [
            { accountNumber: userId },
            ...(Types.ObjectId.isValid(userId) ? [{ _id: new Types.ObjectId(userId) }] : []),
          ],
        })
        .lean();

      if (!customer?.usaepayCustomerId) {
        return new ApiResponse(200, { cards: [] }, 'No saved cards');
      }

      const usaepayCards = await this.usaepay.getSavedCards(customer.usaepayCustomerId);
      let cards = usaepayCards;

      // If USAePay API endpoint returned empty, use cards stored on customer document
      if (!cards || cards.length === 0) {
        const storedCards = customer.savedCards || [];
        if (storedCards.length > 0) {
          cards = storedCards;
        } else if (customer.defaultPayMethodKey || customer.cardLast4) {
          cards = [
            {
              payMethodKey: customer.defaultPayMethodKey || '',
              cardLast4: customer.cardLast4 || '2224',
              cardBrand: customer.cardBrand || 'Visa',
              cardExpiration: '',
              isDefault: true,
            },
          ];
        }
      }

      return new ApiResponse(
        200,
        { cards, customerKey: customer.usaepayCustomerId },
        'Cards fetched successfully',
      );
    } catch (error: any) {
      this.logger.error(`listCards error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Delete (remove) a saved card from USAePay vault.
   */
  async deleteCard(userId: string, payMethodKey: string) {
    try {
      const customer = await this.customerModel
        .findOne({
          $or: [
            { accountNumber: userId },
            ...(Types.ObjectId.isValid(userId) ? [{ _id: new Types.ObjectId(userId) }] : []),
          ],
        })
        .lean();

      if (!customer?.usaepayCustomerId) {
        return new ApiResponse(404, {}, 'No saved payment method found');
      }

      const result = await this.usaepay.deleteCard(
        customer.usaepayCustomerId,
        payMethodKey,
      );

      if (!result.success) {
        return new ApiResponse(400, {}, result.error || 'Failed to delete card');
      }

      await this.customerModel.updateOne(
        { _id: customer._id },
        {
          $pull: { savedCards: { payMethodKey } },
          ...(customer.defaultPayMethodKey === payMethodKey
            ? { $unset: { defaultPayMethodKey: 1, cardLast4: 1, cardBrand: 1 } }
            : {}),
        },
      );

      return new ApiResponse(200, {}, 'Card removed successfully');
    } catch (error: any) {
      this.logger.error(`deleteCard error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ============================================================
  // RIDE PAYMENT — Charge
  // ============================================================

  /**
   * Charge a customer for a completed ride using their saved card.
   * Commission breakdown is snapshotted from the ride record.
   *
   * Only CARD payment method rides are charged here.
   * CASH rides are marked as PAID directly (no gateway).
   */
  async chargeRide(
    userId: string,
    dto: ChargeRideDto,
    rideModel: Model<any>,
  ) {
    try {
      if (!Types.ObjectId.isValid(dto.rideId)) {
        return new ApiResponse(404, {}, 'Ride not found');
      }

      const ride: RideDoc | null = await rideModel.findOne({
        _id: dto.rideId,
        user: userId,
      });

      if (!ride) {
        return new ApiResponse(404, {}, 'Ride not found');
      }

      if (ride.paymentStatus === PaymentStatus.PAID) {
        return new ApiResponse(400, {}, 'Ride is already paid');
      }

      const amount = Number(ride.payableFare || ride.totalFare || 0);

      if (amount <= 0) {
        return new ApiResponse(400, {}, 'Invalid fare amount');
      }

      const effectiveMethod = dto.paymentMethod || ride.paymentMethod;

      // For CASH rides — mark as paid directly
      if (effectiveMethod === PaymentMethod.CASH) {
        const commSnapshot = this.buildCommissionSnapshot(ride, amount);

        // Create a cash transaction record
        const cashTx = await this.txModel.create({
          customerId: userId,
          rideId: dto.rideId,
          driverId: ride.driver || null,
          companyId: ride.companyId || null,
          amount,
          paymentMethod: PaymentMethod.CASH,
          status: PaymentTransactionStatus.SUCCESS,
          description: `Cash payment for ride ${dto.rideId}`,
          commissionSnapshot: commSnapshot,
          chargedAt: new Date(),
        });

        // Update ride payment status & commission snapshot
        await rideModel.updateOne(
          { _id: dto.rideId },
          {
            $set: {
              paymentStatus: PaymentStatus.PAID,
              paymentCollectedAt: new Date(),
              driverEarnings: commSnapshot.driverEarnings,
              companyCommissionAmount: commSnapshot.companyCommissionAmount,
              superAdminCommissionAmount: commSnapshot.superAdminCommissionAmount,
              companyEarnings: commSnapshot.companyEarnings,
              commissionBreakdown: {
                fareAmount: amount,
                driverEarnings: commSnapshot.driverEarnings,
                companyEarnings: commSnapshot.companyEarnings,
                platformEarnings: commSnapshot.platformEarnings,
                superAdminCommission: {
                  type: commSnapshot.superAdminCommissionType,
                  value: commSnapshot.superAdminCommissionValue,
                  amount: commSnapshot.superAdminCommissionAmount,
                },
                companyCommission: {
                  type: commSnapshot.companyCommissionType,
                  value: commSnapshot.companyCommissionValue,
                  amount: commSnapshot.companyCommissionAmount,
                },
              },
            },
          },
        );

        return new ApiResponse(
          200,
          {
            transactionId: String(cashTx._id),
            paymentMethod: 'CASH',
            amount,
            status: 'SUCCESS',
            commissionSnapshot: commSnapshot,
          },
          'Cash payment recorded',
        );
      }

      // For CARD payments — use USAePay
      const customer = await this.customerModel
        .findOne({
          $or: [
            { accountNumber: userId },
            ...(Types.ObjectId.isValid(userId) ? [{ _id: new Types.ObjectId(userId) }] : []),
          ],
        })
        .lean();

      if (!customer?.usaepayCustomerId) {
        return new ApiResponse(
          400,
          {},
          'No saved card found. Please add a card first.',
        );
      }

      const cardCommSnapshot = this.buildCommissionSnapshot(ride, amount);

      // Create a pending transaction record
      const tx = await this.txModel.create({
        customerId: userId,
        rideId: dto.rideId,
        driverId: ride.driver || null,
        companyId: ride.companyId || null,
        amount,
        paymentMethod: PaymentMethod.CARD,
        status: PaymentTransactionStatus.PENDING,
        usaepayCustomerKey: customer.usaepayCustomerId,
        usaepayPayMethodKey: dto.payMethodKey || null,
        cardLast4: customer.cardLast4 || null,
        cardBrand: customer.cardBrand || null,
        description: `Card payment for ride ${dto.rideId}`,
        commissionSnapshot: cardCommSnapshot,
      });

      const payMethodKeyToUse =
        dto.payMethodKey ||
        (customer as any).defaultPayMethodKey ||
        ((customer as any).savedCards && (customer as any).savedCards[0]?.payMethodKey);

      if (!payMethodKeyToUse) {
        return new ApiResponse(
          400,
          {},
          'No saved card found. Please add a card first.',
        );
      }

      // Charge via USAePay
      const chargeResult = await this.usaepay.chargeCustomerCard({
        customerKey: customer.usaepayCustomerId,
        payMethodKey: payMethodKeyToUse,
        amount,
        description: `Ride payment - ${dto.rideId}`,
        orderId: String(tx._id),
      });

      if (chargeResult.success) {
        // Update transaction as SUCCESS
        await this.txModel.updateOne(
          { _id: tx._id },
          {
            $set: {
              status: PaymentTransactionStatus.SUCCESS,
              usaepayTransactionKey: chargeResult.transactionKey,
              refNum: chargeResult.refNum || chargeResult.rawResponse?.refnum,
              rawResponse: chargeResult.rawResponse,
              chargedAt: new Date(),
            },
          },
        );

        // Update ride payment status & commission snapshot
        await rideModel.updateOne(
          { _id: dto.rideId },
          {
            $set: {
              paymentStatus: PaymentStatus.PAID,
              paymentCollectedAt: new Date(),
              driverEarnings: cardCommSnapshot.driverEarnings,
              companyCommissionAmount: cardCommSnapshot.companyCommissionAmount,
              superAdminCommissionAmount: cardCommSnapshot.superAdminCommissionAmount,
              companyEarnings: cardCommSnapshot.companyEarnings,
              commissionBreakdown: {
                fareAmount: amount,
                driverEarnings: cardCommSnapshot.driverEarnings,
                companyEarnings: cardCommSnapshot.companyEarnings,
                platformEarnings: cardCommSnapshot.platformEarnings,
                superAdminCommission: {
                  type: cardCommSnapshot.superAdminCommissionType,
                  value: cardCommSnapshot.superAdminCommissionValue,
                  amount: cardCommSnapshot.superAdminCommissionAmount,
                },
                companyCommission: {
                  type: cardCommSnapshot.companyCommissionType,
                  value: cardCommSnapshot.companyCommissionValue,
                  amount: cardCommSnapshot.companyCommissionAmount,
                },
              },
            },
          },
        );

        // Real-time socket emission to driver and passenger
        try {
          const updatedRide = await rideModel.findById(dto.rideId).lean();
          if (updatedRide && this.socketService) {
            const socketPayload = {
              rideId: String(updatedRide._id),
              status: updatedRide.status,
              paymentStatus: PaymentStatus.PAID,
              paymentMethod: updatedRide.paymentMethod,
              payableFare: updatedRide.payableFare || amount,
              totalFare: updatedRide.totalFare || amount,
              driverEarnings: cardCommSnapshot.driverEarnings,
              companyCommissionAmount: cardCommSnapshot.companyCommissionAmount,
              superAdminCommissionAmount: cardCommSnapshot.superAdminCommissionAmount,
              commissionBreakdown: updatedRide.commissionBreakdown,
              nextAction: null,
            };

            this.socketService.emitToRide(
              String(updatedRide._id),
              'payment:completed',
              socketPayload,
            );
            this.socketService.emitToRide(
              String(updatedRide._id),
              'ride:status',
              socketPayload,
            );

            if (updatedRide.driverId) {
              this.socketService.emitToUser(
                String(updatedRide.driverId),
                'payment:completed',
                socketPayload,
              );
              this.socketService.emitToUser(
                String(updatedRide.driverId),
                'ride:status',
                socketPayload,
              );
            }

            if (updatedRide.passengerId) {
              this.socketService.emitToUser(
                String(updatedRide.passengerId),
                'payment:completed',
                socketPayload,
              );
              this.socketService.emitToUser(
                String(updatedRide.passengerId),
                'ride:status',
                socketPayload,
              );
            }
          }
        } catch (emitErr: any) {
          this.logger.warn(`Failed to emit payment socket: ${emitErr.message}`);
        }

        return new ApiResponse(
          200,
          {
            transactionId: String(tx._id),
            transactionKey: chargeResult.transactionKey,
            authCode: chargeResult.authCode,
            amount,
            status: 'SUCCESS',
            commissionSnapshot: cardCommSnapshot,
          },
          'Payment successful',
        );
      } else {
        // Update transaction as FAILED
        await this.txModel.updateOne(
          { _id: tx._id },
          {
            $set: {
              status: PaymentTransactionStatus.FAILED,
              errorMessage: chargeResult.error,
              rawResponse: chargeResult.rawResponse,
            },
          },
        );

        // Update ride payment status to FAILED
        await rideModel.updateOne(
          { _id: dto.rideId },
          { $set: { paymentStatus: PaymentStatus.FAILED } },
        );

        return new ApiResponse(
          400,
          { error: chargeResult.error },
          `Payment failed: ${chargeResult.error}`,
        );
      }
    } catch (error: any) {
      this.logger.error(`chargeRide error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ============================================================
  // REFUND
  // ============================================================

  /**
   * Refund a transaction (full or partial).
   * Only SUCCESS transactions can be refunded.
   */
  async refundTransaction(userId: string, dto: RefundTransactionDto) {
    try {
      if (!Types.ObjectId.isValid(dto.transactionId)) {
        return new ApiResponse(404, {}, 'Transaction not found');
      }

      const tx = await this.txModel.findOne({
        _id: dto.transactionId,
        customerId: userId,
      });

      if (!tx) {
        return new ApiResponse(404, {}, 'Transaction not found');
      }

      if (tx.status !== PaymentTransactionStatus.SUCCESS) {
        return new ApiResponse(
          400,
          {},
          `Cannot refund a transaction with status: ${tx.status}`,
        );
      }

      if (tx.paymentMethod === PaymentMethod.CASH) {
        return new ApiResponse(400, {}, 'Cash transactions cannot be refunded via gateway');
      }

      if (!tx.usaepayTransactionKey) {
        return new ApiResponse(400, {}, 'No gateway transaction key found for refund');
      }

      const refundAmount = dto.amount || undefined;
      const maxRefundable = tx.amount - (tx.refundedAmount || 0);

      if (refundAmount !== undefined && refundAmount > maxRefundable) {
        return new ApiResponse(
          400,
          {},
          `Refund amount (${refundAmount}) exceeds refundable amount (${maxRefundable})`,
        );
      }

      const refNumToUse =
        (tx as any).refNum ||
        tx.rawResponse?.refnum ||
        tx.usaepayTransactionKey;

      const result = await this.usaepay.refundTransaction({
        transactionKey: tx.usaepayTransactionKey,
        refNum: refNumToUse,
        amount: refundAmount,
      });

      if (result.success) {
        const newRefundedAmount = (tx.refundedAmount || 0) + (refundAmount || tx.amount);
        const isFullRefund = newRefundedAmount >= tx.amount;

        await this.txModel.updateOne(
          { _id: tx._id },
          {
            $set: {
              status: isFullRefund
                ? PaymentTransactionStatus.REFUNDED
                : PaymentTransactionStatus.PARTIALLY_REFUNDED,
              usaepayRefundKey: result.transactionKey,
              refundedAmount: newRefundedAmount,
              refundedAt: new Date(),
            },
          },
        );

        return new ApiResponse(
          200,
          {
            refundTransactionKey: result.transactionKey,
            refundedAmount: refundAmount || tx.amount,
            status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          },
          'Refund processed successfully',
        );
      }

      return new ApiResponse(
        400,
        { error: result.error },
        `Refund failed: ${result.error}`,
      );
    } catch (error: any) {
      this.logger.error(`refundTransaction error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ============================================================
  // TRANSACTION HISTORY
  // ============================================================

  /**
   * Get payment transaction history for a customer.
   */
  async myTransactions(userId: string, query: PaymentQueryDto) {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;

      const [items, total] = await Promise.all([
        this.txModel
          .find({ customerId: userId })
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        this.txModel.countDocuments({ customerId: userId }),
      ]);

      return new ApiResponse(
        200,
        {
          items: items.map((tx) => this.txPayload(tx)),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
        'Transactions fetched successfully',
      );
    } catch (error: any) {
      this.logger.error(`myTransactions error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Get transaction by ID.
   */
  async getTransaction(userId: string, transactionId: string) {
    try {
      if (!Types.ObjectId.isValid(transactionId)) {
        return new ApiResponse(404, {}, 'Transaction not found');
      }

      const tx = await this.txModel
        .findOne({ _id: transactionId, customerId: userId })
        .lean();

      if (!tx) {
        return new ApiResponse(404, {}, 'Transaction not found');
      }

      return new ApiResponse(200, this.txPayload(tx), 'Transaction fetched');
    } catch (error: any) {
      this.logger.error(`getTransaction error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Get payment transaction history for a driver according to Driver Portal UI.
   * Returns:
   * - 3 Summary Cards: TOTAL INFLOWS, TOTAL PAYOUTS, NET BALANCE
   * - Tabs: All Transactions, Earnings, Payouts (with counts)
   * - Table list: Date, Description, Amount, Method, Status, TripCode
   * - Pagination
   */
  async driverTransactions(
    driverId: string,
    query: PaymentQueryDto & {
      tab?: string;
      type?: string;
      status?: string;
      paymentMethod?: string;
    },
  ) {
    try {
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.max(1, Number(query.limit) || 20);
      const selectedTab = String(query.tab || query.type || 'ALL').toUpperCase();

      // 1. Fetch completed rides for this driver (Driver Earnings)
      const rideFilter: any = {
        driver: driverId,
        status: RideStatus.RIDE_COMPLETED,
      };

      const [completedRides, txList] = await Promise.all([
        this.rideModel
          .find(rideFilter)
          .sort({ completedAt: -1, createdAt: -1 })
          .lean(),
        this.txModel
          .find({ driverId })
          .sort({ createdAt: -1 })
          .lean(),
      ]);

      // 2. Map completed rides to transaction items
      const rideTxList = completedRides.map((ride: any) => {
        const earnings = Number(
          (
            ride.driverEarnings != null
              ? ride.driverEarnings
              : ((ride.payableFare || 0) - (ride.companyCommissionAmount || 0)) || (ride.payableFare || 0)
          ).toFixed(2),
        );
        const dateObj = new Date(ride.completedAt || ride.createdAt);
        const dateStr = dateObj.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
        const tripCode = `#TRIP-${String(ride._id).slice(-4).toUpperCase()}`;

        let method = 'Cash';
        const rawMethod = String(ride.paymentMethod || '').toUpperCase();
        if (rawMethod === 'CARD') method = 'Card';
        else if (rawMethod === 'WALLET') method = 'Wallet';
        else if (rawMethod === 'UPI') method = 'UPI';

        return {
          id: String(ride._id),
          date: dateStr,
          rawDate: dateObj.toISOString(),
          description: `Ride Earnings - Trip ${tripCode}`,
          amount: earnings,
          formattedAmount: `+₹${earnings.toLocaleString('en-IN')}`,
          type: 'EARNING',
          direction: 'INFLOW',
          method,
          status: 'Completed',
          statusColor: 'green',
          rideId: String(ride._id),
          tripCode,
          fareAmount: ride.payableFare || ride.totalFare || earnings,
          driverEarnings: earnings,
          commission: ride.companyCommissionAmount || 0,
        };
      });

      // 3. Map any gateway transactions (avoid double-counting if rideId is already in rideTxList)
      const rideIdSet = new Set(completedRides.map((r: any) => String(r._id)));
      const extraTxList = txList
        .filter((tx: any) => !tx.rideId || !rideIdSet.has(String(tx.rideId)))
        .map((tx: any) => {
          const dateObj = new Date(tx.createdAt);
          const isPayout =
            tx.status === PaymentTransactionStatus.REFUNDED ||
            /payout|withdraw/i.test(tx.description || '');
          const amount = Number(
            (tx.commissionSnapshot?.driverEarnings || tx.amount || 0).toFixed(2),
          );
          const tripCode = tx.rideId
            ? `#TRIP-${String(tx.rideId).slice(-4).toUpperCase()}`
            : null;

          return {
            id: String(tx._id),
            date: dateObj.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }),
            rawDate: dateObj.toISOString(),
            description:
              tx.description ||
              (isPayout
                ? 'Withdrawal to bank'
                : `Ride Payment ${tripCode || '#' + String(tx._id).slice(-4).toUpperCase()}`),
            amount: isPayout ? -amount : amount,
            formattedAmount: isPayout
              ? `-₹${amount.toLocaleString('en-IN')}`
              : `+₹${amount.toLocaleString('en-IN')}`,
            type: isPayout ? 'PAYOUT' : 'EARNING',
            direction: isPayout ? 'OUTFLOW' : 'INFLOW',
            method:
              tx.paymentMethod === PaymentMethod.CARD
                ? 'Card'
                : isPayout
                  ? 'Bank Transfer'
                  : 'Cash',
            status:
              tx.status === PaymentTransactionStatus.SUCCESS
                ? 'Completed'
                : tx.status,
            statusColor:
              tx.status === PaymentTransactionStatus.SUCCESS ? 'green' : 'red',
            rideId: tx.rideId || null,
            tripCode,
            fareAmount: tx.amount,
            driverEarnings: amount,
            commission: tx.commissionSnapshot?.companyCommissionAmount || 0,
          };
        });

      // 4. Combine all transactions and sort by date descending
      const allTransactions = [...rideTxList, ...extraTxList].sort(
        (a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime(),
      );

      // 5. Compute the exact 3 cards matching UI
      const totalInflows = Number(
        allTransactions
          .filter((t) => t.type === 'EARNING')
          .reduce((acc, t) => acc + t.amount, 0)
          .toFixed(2),
      );
      const totalPayouts = Number(
        Math.abs(
          allTransactions
            .filter((t) => t.type === 'PAYOUT')
            .reduce((acc, t) => acc + t.amount, 0),
        ).toFixed(2),
      );
      const netBalance = Number((totalInflows - totalPayouts).toFixed(2));

      const cards = {
        totalInflows: {
          amount: totalInflows,
          formatted: `+₹${totalInflows.toLocaleString('en-IN')}`,
          label: 'TOTAL INFLOWS',
          sublabel: 'Rides & incentives',
          icon: 'inflow',
          direction: 'INFLOW',
        },
        totalPayouts: {
          amount: totalPayouts,
          formatted: `-₹${totalPayouts.toLocaleString('en-IN')}`,
          label: 'TOTAL PAYOUTS',
          sublabel: 'Withdrawn to bank',
          icon: 'payout',
          direction: 'OUTFLOW',
        },
        netBalance: {
          amount: netBalance,
          formatted: `${netBalance >= 0 ? '+' : '-'}₹${Math.abs(netBalance).toLocaleString('en-IN')}`,
          label: 'NET BALANCE',
          sublabel: 'Available for transfer',
          icon: 'wallet',
          direction: 'BALANCE',
        },
      };

      // 6. Tabs
      const earningsCount = allTransactions.filter((t) => t.type === 'EARNING').length;
      const payoutsCount = allTransactions.filter((t) => t.type === 'PAYOUT').length;
      const tabs = [
        { key: 'ALL', label: 'All Transactions', count: allTransactions.length },
        { key: 'EARNINGS', label: 'Earnings', count: earningsCount },
        { key: 'PAYOUTS', label: 'Payouts', count: payoutsCount },
      ];

      // 7. Filter by tab / query
      let filtered = allTransactions;
      if (selectedTab === 'EARNINGS') {
        filtered = allTransactions.filter((t) => t.type === 'EARNING');
      } else if (selectedTab === 'PAYOUTS') {
        filtered = allTransactions.filter((t) => t.type === 'PAYOUT');
      }

      if (query.paymentMethod) {
        filtered = filtered.filter(
          (t) =>
            t.method.toLowerCase() === String(query.paymentMethod).toLowerCase(),
        );
      }

      if (query.status) {
        filtered = filtered.filter(
          (t) =>
            t.status.toLowerCase() === String(query.status).toLowerCase(),
        );
      }

      // 8. Pagination
      const total = filtered.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const paginatedItems = filtered.slice((page - 1) * limit, page * limit);

      return new ApiResponse(
        200,
        {
          cards,
          tabs,
          activeTab: selectedTab,
          transactions: paginatedItems,
          // Backward compatibility fields
          items: paginatedItems.map((tx) => ({
            ...tx,
            transactionId: tx.id,
          })),
          pagination: {
            total,
            page,
            limit,
            totalPages,
          },
          total,
          page,
          limit,
          totalPages,
          summary: {
            totalInflows,
            totalPayouts,
            netBalance,
            totalSuccessfulTrips: earningsCount,
          },
        },
        'Driver transactions fetched successfully',
      );
    } catch (error: any) {
      this.logger.error(`driverTransactions error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ============================================================
  // Admin: All transactions (Superadmin)
  // ============================================================
  async allTransactions(query: PaymentQueryDto & { customerId?: string; rideId?: string; status?: string }) {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;

      const filter: any = {};
      if (query.customerId) filter.customerId = query.customerId;
      if (query.rideId) filter.rideId = query.rideId;
      if (query.status) filter.status = query.status;

      const [items, total] = await Promise.all([
        this.txModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        this.txModel.countDocuments(filter),
      ]);

      return new ApiResponse(
        200,
        {
          items: items.map((tx) => this.txPayload(tx)),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
        'Transactions fetched successfully',
      );
    } catch (error: any) {
      this.logger.error(`allTransactions error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  /**
   * Find or create a USAePay customer vault entry for a user.
   * Links the vault key back to the customer document.
   */
  private async findOrCreateCustomerVault(userId: string): Promise<CustomerDocument | null> {
    // Try to find by accountNumber or _id
    let customer = await this.customerModel.findOne({
      $or: [
        { accountNumber: userId },
        ...(Types.ObjectId.isValid(userId) ? [{ _id: new Types.ObjectId(userId) }] : []),
      ],
    });

    if (!customer) {
      const lastCustomer = await this.customerModel
        .findOne()
        .sort({ customerId: -1 });
      const newCustomerId =
        lastCustomer && lastCustomer.customerId
          ? lastCustomer.customerId + 1
          : 1;

      customer = new this.customerModel({
        customerId: newCustomerId,
        accountNumber: userId,
        fullName: 'Carline Passenger',
        autoEmail: 'Inactive',
        credit: 0,
        createdBy: 'PAYMENT_MODULE',
        createdOn: new Date().toLocaleString(),
      });
      await customer.save();
    }

    if (!customer.usaepayCustomerId) {
      // Create in USAePay vault
      const result = await this.usaepay.createOrUpdateCustomer({
        email: customer.email || undefined,
        name: customer.fullName || undefined,
      });

      if (!result.success || !result.customerKey) {
        this.logger.error(`Failed to create USAePay customer vault for userId=${userId}`);
        return null;
      }

      customer.usaepayCustomerId = result.customerKey;
      await customer.save();
    }

    return customer;
  }

  /**
   * Build commission snapshot from a ride document.
   * Default values apply if commission was not calculated (e.g. legacy rides).
   */
  private buildCommissionSnapshot(ride: RideDoc, fareAmount: number): CommissionSnapshot {
    const breakdown = ride.commissionBreakdown || {};

    const superAdminAmount =
      (ride.superAdminCommissionAmount && ride.superAdminCommissionAmount > 0)
        ? ride.superAdminCommissionAmount
        : (breakdown.superAdminCommission?.amount || Number((fareAmount * 0.05).toFixed(2)));

    const companyAmount =
      (ride.companyCommissionAmount && ride.companyCommissionAmount > 0)
        ? ride.companyCommissionAmount
        : (breakdown.companyCommission?.amount || Number((fareAmount * 0.15).toFixed(2)));

    const driverAmount =
      (ride.driverEarnings && ride.driverEarnings > 0)
        ? ride.driverEarnings
        : (breakdown.driverEarnings || Number((fareAmount - companyAmount).toFixed(2)));

    const companyEarn =
      (ride.companyEarnings && ride.companyEarnings > 0)
        ? ride.companyEarnings
        : (breakdown.companyEarnings || Number((companyAmount - superAdminAmount).toFixed(2)));

    const platformEarn =
      breakdown.platformEarnings || superAdminAmount;

    return {
      fareAmount,
      superAdminCommissionType: breakdown.superAdminCommission?.type || 'PERCENTAGE',
      superAdminCommissionValue: breakdown.superAdminCommission?.value ?? 5,
      superAdminCommissionAmount: superAdminAmount,
      companyCommissionType: breakdown.companyCommission?.type || 'PERCENTAGE',
      companyCommissionValue: breakdown.companyCommission?.value ?? 15,
      companyCommissionAmount: companyAmount,
      driverEarnings: driverAmount,
      companyEarnings: companyEarn,
      platformEarnings: platformEarn,
      isCustomDriverRate: Boolean(breakdown.companyCommission?.isCustomDriverRate),
    };
  }

  private txPayload(tx: any) {
    return {
      transactionId: String(tx._id),
      rideId: tx.rideId || null,
      amount: tx.amount,
      paymentMethod: tx.paymentMethod,
      status: tx.status,
      cardLast4: tx.cardLast4 || null,
      cardBrand: tx.cardBrand || null,
      refundedAmount: tx.refundedAmount || 0,
      commissionSnapshot: tx.commissionSnapshot || null,
      errorMessage: tx.errorMessage || null,
      description: tx.description || null,
      chargedAt: tx.chargedAt || null,
      refundedAt: tx.refundedAt || null,
      createdAt: tx.createdAt,
    };
  }

  // ============================================================
  // DRIVER FINANCIAL MANAGEMENT: PAYOUT REQUESTS & APPROVALS
  // ============================================================

  /**
   * Driver submits a payout/withdrawal request.
   * Validates available balance (earnings - existing payouts - pending requests).
   */
  async requestPayout(driverId: string, dto: CreatePayoutRequestDto) {
    try {
      if (!Types.ObjectId.isValid(driverId)) {
        return new ApiResponse(400, {}, 'Invalid ID');
      }

      const driver = await this.driverModel.findById(driverId);
      if (!driver) {
        return new ApiResponse(404, {}, Msg.DRIVER_NOT_FOUND);
      }

      // Calculate total inflows (all earnings from completed rides)
      const completedRides = await this.rideModel.find({
        driver: driverId,
        status: RideStatus.RIDE_COMPLETED,
      });

      const totalInflows = Number(
        completedRides
          .reduce(
            (sum: number, r: any) =>
              sum + (Number(r.driverEarnings) || Number(r.payableFare) || Number(r.totalFare) || 0),
            0,
          )
          .toFixed(2),
      );

      // Calculate total approved/paid payouts
      const approvedPayouts = await this.payoutModel.find({
        driverId: String(driverId),
        status: { $in: [PayoutStatus.APPROVED, PayoutStatus.TRANSFERRED] },
      });

      const totalApprovedAmount = Number(
        approvedPayouts
          .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
          .toFixed(2),
      );

      // Calculate total pending payout requests currently on hold
      const pendingPayouts = await this.payoutModel.find({
        driverId: String(driverId),
        status: PayoutStatus.PENDING,
      });

      const totalPendingAmount = Number(
        pendingPayouts
          .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
          .toFixed(2),
      );

      const netBalance = Number((totalInflows - totalApprovedAmount).toFixed(2));
      const availableBalance = Number((netBalance - totalPendingAmount).toFixed(2));

      if (dto.amount > availableBalance) {
        return new ApiResponse(
          400,
          {
            requestedAmount: dto.amount,
            netBalance,
            pendingHolds: totalPendingAmount,
            availableBalance,
          },
          `Insufficient balance. You have an available balance of $${availableBalance} (Net balance: $${netBalance}, Pending requests: $${totalPendingAmount}).`,
        );
      }

      const payout = await this.payoutModel.create({
        driverId: String(driverId),
        driverName: driver.fullName || null,
        companyId: driver.companyId ? String(driver.companyId) : null,
        amount: Number(dto.amount),
        currency: 'USD',
        status: PayoutStatus.PENDING,
        bankDetails: dto.bankDetails,
        notes: dto.notes || null,
        requestedAt: new Date(),
      });

      try {
        this.socketService?.emitToUser(
          String(driverId),
          'payout:created',
          this.payoutPayload(payout),
        );
      } catch (err: any) {
        this.logger.warn(`Failed to emit socket for payout: ${err.message}`);
      }

      return new ApiResponse(
        201,
        this.payoutPayload(payout),
        'Payout request submitted successfully and is pending company approval',
      );
    } catch (error: any) {
      this.logger.error(`requestPayout error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Driver lists their payout requests with status filter & pagination.
   */
  async getDriverPayouts(driverId: string, query: GetPayoutsQueryDto) {
    try {
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
      const skip = (page - 1) * limit;

      const filter: any = { driverId: String(driverId) };
      if (query.status) {
        filter.status = query.status;
      }

      const [payouts, total] = await Promise.all([
        this.payoutModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        this.payoutModel.countDocuments(filter),
      ]);

      // Summary statistics
      const allDriverPayouts = await this.payoutModel.find({ driverId: String(driverId) });
      const stats = {
        totalRequested: Number(
          allDriverPayouts.reduce((acc, p) => acc + (Number(p.amount) || 0), 0).toFixed(2),
        ),
        totalApproved: Number(
          allDriverPayouts
            .filter((p) => p.status === PayoutStatus.APPROVED || p.status === PayoutStatus.TRANSFERRED)
            .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
            .toFixed(2),
        ),
        totalPending: Number(
          allDriverPayouts
            .filter((p) => p.status === PayoutStatus.PENDING)
            .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
            .toFixed(2),
        ),
        totalRejected: Number(
          allDriverPayouts
            .filter((p) => p.status === PayoutStatus.REJECTED)
            .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
            .toFixed(2),
        ),
      };

      return new ApiResponse(
        200,
        {
          payouts: payouts.map((p) => this.payoutPayload(p)),
          stats,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
        'Driver payouts retrieved successfully',
      );
    } catch (error: any) {
      this.logger.error(`getDriverPayouts error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Get single payout details.
   */
  async getPayoutById(payoutId: string, allowedDriverOrCompanyId?: string) {
    try {
      if (!Types.ObjectId.isValid(payoutId)) {
        return new ApiResponse(400, {}, 'Invalid ID');
      }

      const payout = await this.payoutModel.findById(payoutId);
      if (!payout) {
        return new ApiResponse(404, {}, 'Payout request not found');
      }

      if (
        allowedDriverOrCompanyId &&
        String(payout.driverId) !== String(allowedDriverOrCompanyId) &&
        String(payout.companyId) !== String(allowedDriverOrCompanyId)
      ) {
        return new ApiResponse(403, {}, 'Access denied to this payout request');
      }

      return new ApiResponse(200, this.payoutPayload(payout), 'Payout details fetched successfully');
    } catch (error: any) {
      this.logger.error(`getPayoutById error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Company Admin / Super Admin lists payout requests with filters and stats.
   */
  async getCompanyPayouts(currentUser: any, query: GetPayoutsQueryDto) {
    try {
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
      const skip = (page - 1) * limit;

      const filter: any = {};

      // If user is company staff, constrain to their company
      if (currentUser.companyId) {
        filter.companyId = String(currentUser.companyId);
      }

      if (query.status) {
        filter.status = query.status;
      }

      const [payouts, total] = await Promise.all([
        this.payoutModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        this.payoutModel.countDocuments(filter),
      ]);

      return new ApiResponse(
        200,
        {
          payouts: payouts.map((p) => this.payoutPayload(p)),
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
        'Company payout requests fetched successfully',
      );
    } catch (error: any) {
      this.logger.error(`getCompanyPayouts error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Company Admin or Super Admin approves a driver payout request.
   * Marks as APPROVED / TRANSFERRED and creates an Outflow PaymentTransaction.
   */
  async approvePayout(currentUser: any, payoutId: string, dto: ApprovePayoutDto) {
    try {
      if (!Types.ObjectId.isValid(payoutId)) {
        return new ApiResponse(400, {}, 'Invalid ID');
      }

      const payout = await this.payoutModel.findById(payoutId);
      if (!payout) {
        return new ApiResponse(404, {}, 'Payout request not found');
      }

      if (
        currentUser.companyId &&
        String(payout.companyId) !== String(currentUser.companyId)
      ) {
        return new ApiResponse(403, {}, 'Access denied: Payout belongs to another company');
      }

      if (payout.status !== PayoutStatus.PENDING) {
        return new ApiResponse(
          400,
          {},
          `Cannot approve payout with status '${payout.status}'. Only PENDING payouts can be approved.`,
        );
      }

      payout.status = PayoutStatus.APPROVED;
      payout.processedAt = new Date();
      payout.processedBy = String(currentUser.id || currentUser._id);
      payout.transferReference = dto.transferReference || `TXN-PO-${Date.now()}`;
      if (dto.notes) {
        payout.notes = payout.notes ? `${payout.notes} | ${dto.notes}` : dto.notes;
      }

      // Create an OUTFLOW PaymentTransaction so it appears in the Driver Transactions table and reduces NET BALANCE
      const tx = await this.txModel.create({
        customerId: String(payout.driverId),
        driverId: String(payout.driverId),
        companyId: payout.companyId ? String(payout.companyId) : null,
        amount: Number(payout.amount),
        paymentMethod: PaymentMethod.WALLET,
        status: PaymentTransactionStatus.SUCCESS,
        description: `Driver Payout Transfer (#${payout.transferReference})`,
        chargedAt: new Date(),
      });

      payout.transactionId = String(tx._id);
      await payout.save();

      try {
        this.socketService?.emitToUser(
          String(payout.driverId),
          'payout:updated',
          this.payoutPayload(payout),
        );
      } catch (err: any) {
        this.logger.warn(`Failed to emit socket for payout approval: ${err.message}`);
      }

      return new ApiResponse(
        200,
        this.payoutPayload(payout),
        'Payout request approved and outflow recorded successfully',
      );
    } catch (error: any) {
      this.logger.error(`approvePayout error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Company Admin or Super Admin rejects a driver payout request.
   */
  async rejectPayout(currentUser: any, payoutId: string, dto: RejectPayoutDto) {
    try {
      if (!Types.ObjectId.isValid(payoutId)) {
        return new ApiResponse(400, {}, 'Invalid ID');
      }

      const payout = await this.payoutModel.findById(payoutId);
      if (!payout) {
        return new ApiResponse(404, {}, 'Payout request not found');
      }

      if (
        currentUser.companyId &&
        String(payout.companyId) !== String(currentUser.companyId)
      ) {
        return new ApiResponse(403, {}, 'Access denied: Payout belongs to another company');
      }

      if (payout.status !== PayoutStatus.PENDING) {
        return new ApiResponse(
          400,
          {},
          `Cannot reject payout with status '${payout.status}'. Only PENDING payouts can be rejected.`,
        );
      }

      payout.status = PayoutStatus.REJECTED;
      payout.rejectionReason = dto.rejectionReason;
      payout.processedAt = new Date();
      payout.processedBy = String(currentUser.id || currentUser._id);
      await payout.save();

      try {
        this.socketService?.emitToUser(
          String(payout.driverId),
          'payout:updated',
          this.payoutPayload(payout),
        );
      } catch (err: any) {
        this.logger.warn(`Failed to emit socket for payout rejection: ${err.message}`);
      }

      return new ApiResponse(200, this.payoutPayload(payout), 'Payout request rejected successfully');
    } catch (error: any) {
      this.logger.error(`rejectPayout error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  // ============================================================
  // PASSENGER WALLET & SPLIT PAYMENT
  // ============================================================

  /**
   * Passenger recharges their wallet using a saved card (USAePay customer vault).
   * Note: Recharged wallet funds are non-withdrawable ride credits.
   */
  async topUpWallet(userId: string, dto: TopUpWalletDto) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return new ApiResponse(400, {}, 'Invalid user ID');
      }

      const amount = Number(dto.amount);
      if (isNaN(amount) || amount <= 0) {
        return new ApiResponse(400, {}, 'Top-up amount must be greater than 0');
      }

      const user = await this.userModel.findById(userId);
      if (!user) {
        return new ApiResponse(404, {}, 'User not found');
      }

      // Find or create customer in Customer collection for USAePay vault
      let customer = await this.customerModel.findOne({
        $or: [{ userId }, { user: userId }, { email: user.email }],
      });

      if (!customer || !customer.usaepayCustomerId) {
        return new ApiResponse(
          400,
          {},
          'No payment vault profile found for this user. Please save a card first.',
        );
      }

      const chargeResult = await this.usaepay.chargeCustomerCard({
        customerKey: customer.usaepayCustomerId,
        payMethodKey: dto.payMethodKey,
        amount,
        description: dto.description || `Wallet Top-up (+$${amount.toFixed(2)})`,
      });

      if (!chargeResult.success) {
        return new ApiResponse(
          400,
          { error: chargeResult.error },
          chargeResult.error || 'Card charge failed. Unable to recharge wallet.',
        );
      }

      // Increment user wallet balance
      await this.userModel.updateOne(
        { _id: userId },
        { $inc: { walletBalance: amount } },
      );

      // Create PaymentTransaction audit record
      const tx = await this.txModel.create({
        customerId: String(customer._id || userId),
        amount,
        paymentMethod: PaymentMethod.CARD,
        status: PaymentTransactionStatus.SUCCESS,
        usaepayTransactionKey: chargeResult.transactionKey,
        refNum: chargeResult.refNum,
        cardLast4: customer.cardLast4 || null,
        cardBrand: customer.cardBrand || null,
        chargedAt: new Date(),
        description: `Wallet Top-up (+$${amount.toFixed(2)})`,
      });

      const updatedUser = await this.userModel.findById(userId).select('walletBalance');
      const newBalance = Number(updatedUser?.walletBalance || 0);

      // Emit socket event to user
      try {
        this.socketService?.emitToUser(userId, 'wallet:updated', {
          walletBalance: newBalance,
          formattedBalance: `$${newBalance.toFixed(2)}`,
          transactionId: String(tx._id),
          amountAdded: amount,
        });
      } catch (err: any) {
        this.logger.warn(`Failed to emit wallet:updated socket: ${err.message}`);
      }

      return new ApiResponse(
        200,
        {
          walletBalance: newBalance,
          formattedBalance: `$${newBalance.toFixed(2)}`,
          currency: 'USD',
          isWithdrawable: false,
          transactionId: String(tx._id),
          refNum: chargeResult.refNum,
          cardLast4: customer.cardLast4 || null,
        },
        'Wallet recharged successfully',
      );
    } catch (error: any) {
      this.logger.error(`topUpWallet error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Get passenger wallet balance and passbook transaction history.
   */
  async getWalletDetails(userId: string, query: WalletHistoryQueryDto) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return new ApiResponse(400, {}, 'Invalid user ID');
      }

      const user = await this.userModel.findById(userId);
      if (!user) {
        return new ApiResponse(404, {}, 'User not found');
      }

      const walletBalance = Number(user.walletBalance || 0);

      const customer = await this.customerModel.findOne({
        $or: [{ userId }, { user: userId }, { email: user.email }],
      });
      const customerIds = [String(userId)];
      if (customer) {
        customerIds.push(String(customer._id));
      }

      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
      const skip = (page - 1) * limit;

      const walletFilter = {
        customerId: { $in: customerIds },
        status: PaymentTransactionStatus.SUCCESS,
        $or: [
          { description: { $regex: /wallet top-up/i } },
          { paymentMethod: PaymentMethod.WALLET },
        ],
      };

      const [txs, total] = await Promise.all([
        this.txModel.find(walletFilter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        this.txModel.countDocuments(walletFilter),
      ]);

      let totalRecharged = 0;
      let totalSpentOnRides = 0;

      const allTxs = await this.txModel.find(walletFilter).select('amount description paymentMethod');
      for (const t of allTxs) {
        if (/wallet top-up/i.test(t.description || '')) {
          totalRecharged += Number(t.amount || 0);
        } else {
          totalSpentOnRides += Number(t.amount || 0);
        }
      }

      const history = txs.map((t) => {
        const isTopUp = /wallet top-up/i.test(t.description || '');
        return {
          transactionId: String(t._id),
          type: isTopUp ? 'CREDIT' : 'DEBIT',
          direction: isTopUp ? 'INFLOW' : 'OUTFLOW',
          amount: Number(t.amount),
          formattedAmount: `${isTopUp ? '+' : '-'}$${Number(t.amount).toFixed(2)}`,
          description: t.description || (isTopUp ? 'Wallet Top-up' : 'Ride Payment'),
          paymentMethod: isTopUp ? 'Card' : 'Wallet',
          rideId: t.rideId ? String(t.rideId) : null,
          status: t.status,
          date: t.chargedAt || (t as any).createdAt,
        };
      });

      return new ApiResponse(
        200,
        {
          walletBalance: Number(walletBalance.toFixed(2)),
          formattedBalance: `$${walletBalance.toFixed(2)}`,
          currency: 'USD',
          isWithdrawable: false,
          stats: {
            totalRecharged: Number(totalRecharged.toFixed(2)),
            totalSpentOnRides: Number(totalSpentOnRides.toFixed(2)),
          },
          transactions: history,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
        'Wallet details fetched successfully',
      );
    } catch (error: any) {
      this.logger.error(`getWalletDetails error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  /**
   * Pay ride fare using passenger wallet (Full payment or Split payment with Cash / Card).
   * Example: $100 wallet balance on a $120 ride -> $100 deducted from wallet, remaining $20 payable via Cash/Card.
   */
  async payRideWithWallet(userId: string, dto: PayRideWithWalletDto) {
    try {
      if (!Types.ObjectId.isValid(userId)) {
        return new ApiResponse(400, {}, 'Invalid user ID');
      }
      if (!Types.ObjectId.isValid(dto.rideId)) {
        return new ApiResponse(400, {}, 'Invalid ride ID');
      }

      const [user, ride] = await Promise.all([
        this.userModel.findById(userId),
        this.rideModel.findById(dto.rideId),
      ]);

      if (!user) {
        return new ApiResponse(404, {}, 'User not found');
      }
      if (!ride) {
        return new ApiResponse(404, {}, 'Ride not found');
      }

      if (String(ride.user) !== String(userId)) {
        return new ApiResponse(403, {}, 'Access denied: This ride does not belong to your account');
      }

      if (ride.paymentStatus === PaymentStatus.PAID) {
        return new ApiResponse(400, {}, 'Ride fare is already paid in full');
      }

      // Calculate the amount currently due
      const currentDue = Number(
        (ride.remainingPayableFare !== null && ride.remainingPayableFare !== undefined)
          ? ride.remainingPayableFare
          : (ride.payableFare ?? ride.totalFare),
      );

      if (currentDue <= 0) {
        return new ApiResponse(400, {}, 'No pending fare remaining for this ride');
      }

      const walletBalance = Number(user.walletBalance || 0);
      if (walletBalance <= 0) {
        return new ApiResponse(
          400,
          { walletBalance: 0, requiredAmount: currentDue },
          'Wallet balance is $0.00. Please recharge your wallet or pay via Cash/Card.',
        );
      }

      const customer = await this.customerModel.findOne({
        $or: [{ userId }, { user: userId }, { email: user.email }],
      });

      // CASE 1: FULL WALLET PAYMENT (Wallet balance >= currentDue)
      if (walletBalance >= currentDue) {
        const deducted = currentDue;

        await this.userModel.updateOne(
          { _id: userId },
          { $inc: { walletBalance: -deducted } },
        );

        ride.walletAmountDeducted = Number(((ride.walletAmountDeducted || 0) + deducted).toFixed(2));
        ride.remainingPayableFare = 0;
        ride.payableFare = 0;
        ride.paymentMethod = PaymentMethod.WALLET;
        ride.paymentStatus = PaymentStatus.PAID;
        ride.paymentCollectedAt = new Date();
        await ride.save();

        // Update driver status to ACTIVE if completed
        if (ride.driver) {
          await this.driverModel.updateOne(
            { _id: ride.driver },
            { $set: { status: 'ACTIVE' } },
          );
        }

        // Record PaymentTransaction for wallet
        await this.txModel.create({
          customerId: String(customer?._id || userId),
          rideId: String(ride._id),
          driverId: ride.driver ? String(ride.driver) : null,
          companyId: ride.companyId ? String(ride.companyId) : null,
          amount: deducted,
          paymentMethod: PaymentMethod.WALLET,
          status: PaymentTransactionStatus.SUCCESS,
          chargedAt: new Date(),
          description: `Full trip payment via Wallet for Ride #${ride._id}`,
        });

        const updatedUser = await this.userModel.findById(userId).select('walletBalance');
        const remainingWallet = Number(updatedUser?.walletBalance || 0);

        const socketPayload = {
          rideId: String(ride._id),
          status: ride.status,
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: PaymentMethod.WALLET,
          totalFare: ride.totalFare,
          walletAmountDeducted: ride.walletAmountDeducted,
          remainingPayableFare: 0,
          cashToCollect: 0,
        };

        try {
          this.socketService?.emitToRide(String(ride._id), 'payment:completed', socketPayload);
          this.socketService?.emitToRide(String(ride._id), 'ride:status', socketPayload);
          if (ride.driver) {
            this.socketService?.emitToUser(String(ride.driver), 'payment:completed', socketPayload);
            this.socketService?.emitToUser(String(ride.driver), 'ride:status', socketPayload);
          }
          this.socketService?.emitToUser(String(ride.user), 'payment:completed', socketPayload);
          this.socketService?.emitToUser(String(ride.user), 'wallet:updated', {
            walletBalance: remainingWallet,
            formattedBalance: `$${remainingWallet.toFixed(2)}`,
          });
          this.socketService?.leaveRideRoom(String(ride._id));
        } catch (err: any) {
          this.logger.warn(`Socket notification error: ${err.message}`);
        }

        return new ApiResponse(
          200,
          {
            isFullPayment: true,
            totalFare: ride.totalFare,
            walletDeducted: deducted,
            remainingToPay: 0,
            paymentStatus: PaymentStatus.PAID,
            remainingWalletBalance: remainingWallet,
          },
          `Full fare of $${deducted.toFixed(2)} paid successfully from wallet`,
        );
      }

      // CASE 2: SPLIT PAYMENT (0 < Wallet balance < currentDue)
      // E.g. $100 wallet on a $120 ride -> $100 deducted from wallet, $20 remaining
      const walletDeducted = walletBalance;
      const remainingDue = Number((currentDue - walletDeducted).toFixed(2));

      // Exhaust wallet balance
      await this.userModel.updateOne(
        { _id: userId },
        { $set: { walletBalance: 0 } },
      );

      // Record wallet transaction portion
      await this.txModel.create({
        customerId: String(customer?._id || userId),
        rideId: String(ride._id),
        driverId: ride.driver ? String(ride.driver) : null,
        companyId: ride.companyId ? String(ride.companyId) : null,
        amount: walletDeducted,
        paymentMethod: PaymentMethod.WALLET,
        status: PaymentTransactionStatus.SUCCESS,
        chargedAt: new Date(),
        description: `Split trip payment via Wallet ($${walletDeducted.toFixed(2)}) for Ride #${ride._id}`,
      });

      // If user chose to pay the remaining via card immediately
      if (dto.remainingPaymentMethod === PaymentMethod.CARD && dto.payMethodKey && customer?.usaepayCustomerId) {
        const cardCharge = await this.usaepay.chargeCustomerCard({
          customerKey: customer.usaepayCustomerId,
          payMethodKey: dto.payMethodKey,
          amount: remainingDue,
          description: `Remaining trip payment for Ride #${ride._id}`,
        });

        if (cardCharge.success) {
          ride.walletAmountDeducted = Number(((ride.walletAmountDeducted || 0) + walletDeducted).toFixed(2));
          ride.remainingPayableFare = 0;
          ride.payableFare = 0;
          ride.paymentMethod = PaymentMethod.CARD;
          ride.paymentStatus = PaymentStatus.PAID;
          ride.paymentCollectedAt = new Date();
          await ride.save();

          if (ride.driver) {
            await this.driverModel.updateOne(
              { _id: ride.driver },
              { $set: { status: 'ACTIVE' } },
            );
          }

          await this.txModel.create({
            customerId: String(customer._id || userId),
            rideId: String(ride._id),
            driverId: ride.driver ? String(ride.driver) : null,
            companyId: ride.companyId ? String(ride.companyId) : null,
            amount: remainingDue,
            paymentMethod: PaymentMethod.CARD,
            status: PaymentTransactionStatus.SUCCESS,
            usaepayTransactionKey: cardCharge.transactionKey,
            refNum: cardCharge.refNum,
            cardLast4: customer.cardLast4 || null,
            cardBrand: customer.cardBrand || null,
            chargedAt: new Date(),
            description: `Remaining split trip payment via Card for Ride #${ride._id}`,
          });

          const socketPayload = {
            rideId: String(ride._id),
            status: ride.status,
            paymentStatus: PaymentStatus.PAID,
            totalFare: ride.totalFare,
            walletAmountDeducted: ride.walletAmountDeducted,
            cardAmountDeducted: remainingDue,
            remainingPayableFare: 0,
            cashToCollect: 0,
          };

          try {
            this.socketService?.emitToRide(String(ride._id), 'payment:completed', socketPayload);
            this.socketService?.emitToRide(String(ride._id), 'ride:status', socketPayload);
            if (ride.driver) {
              this.socketService?.emitToUser(String(ride.driver), 'payment:completed', socketPayload);
            }
            this.socketService?.emitToUser(String(ride.user), 'wallet:updated', {
              walletBalance: 0,
              formattedBalance: '$0.00',
            });
            this.socketService?.leaveRideRoom(String(ride._id));
          } catch (err: any) {
            this.logger.warn(`Socket notification error: ${err.message}`);
          }

          return new ApiResponse(
            200,
            {
              isFullPayment: true,
              totalFare: ride.totalFare,
              walletDeducted,
              cardDeducted: remainingDue,
              remainingToPay: 0,
              paymentStatus: PaymentStatus.PAID,
              remainingWalletBalance: 0,
            },
            `Ride payment completed successfully: $${walletDeducted.toFixed(2)} from wallet and $${remainingDue.toFixed(2)} from card`,
          );
        }
      }

      // Default Split: Remaining via CASH (collected by driver)
      ride.walletAmountDeducted = Number(((ride.walletAmountDeducted || 0) + walletDeducted).toFixed(2));
      ride.remainingPayableFare = remainingDue;
      ride.payableFare = remainingDue;
      ride.remainingPaymentMethod = PaymentMethod.CASH;
      ride.paymentMethod = PaymentMethod.CASH;
      ride.paymentStatus = PaymentStatus.PENDING;
      await ride.save();

      const socketPayload = {
        rideId: String(ride._id),
        status: ride.status,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.CASH,
        totalFare: ride.totalFare,
        walletAmountDeducted: ride.walletAmountDeducted,
        remainingPayableFare: remainingDue,
        cashToCollect: remainingDue,
      };

      try {
        this.socketService?.emitToRide(String(ride._id), 'payment:partial', socketPayload);
        this.socketService?.emitToRide(String(ride._id), 'ride:status', socketPayload);
        if (ride.driver) {
          this.socketService?.emitToUser(String(ride.driver), 'payment:partial', socketPayload);
          this.socketService?.emitToUser(String(ride.driver), 'ride:status', socketPayload);
        }
        this.socketService?.emitToUser(String(ride.user), 'wallet:updated', {
          walletBalance: 0,
          formattedBalance: '$0.00',
        });
      } catch (err: any) {
        this.logger.warn(`Socket notification error: ${err.message}`);
      }

      return new ApiResponse(
        200,
        {
          isFullPayment: false,
          totalFare: ride.totalFare,
          walletDeducted,
          remainingToPay: remainingDue,
          remainingPaymentMethod: PaymentMethod.CASH,
          cashToCollect: remainingDue,
          paymentStatus: PaymentStatus.PENDING,
          remainingWalletBalance: 0,
        },
        `$${walletDeducted.toFixed(2)} deducted from wallet. Remaining $${remainingDue.toFixed(2)} to be collected in cash by driver.`,
      );
    } catch (error: any) {
      this.logger.error(`payRideWithWallet error: ${error.message}`);
      return new ApiResponse(500, {}, Msg.SERVER_ERROR);
    }
  }

  private payoutPayload(payout: any) {
    return {
      payoutId: String(payout._id),
      driverId: String(payout.driverId),
      driverName: payout.driverName || null,
      companyId: payout.companyId ? String(payout.companyId) : null,
      amount: Number(payout.amount),
      currency: payout.currency || 'USD',
      formattedAmount: `${payout.currency || '$'}${Number(payout.amount).toFixed(2)}`,
      status: payout.status,
      bankDetails: payout.bankDetails || null,
      requestedAt: payout.requestedAt || payout.createdAt,
      processedAt: payout.processedAt || null,
      processedBy: payout.processedBy || null,
      transferReference: payout.transferReference || null,
      transactionId: payout.transactionId || null,
      notes: payout.notes || null,
      rejectionReason: payout.rejectionReason || null,
    };
  }
}

