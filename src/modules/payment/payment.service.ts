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

import {
  PaymentTransaction,
  PaymentTransactionDocument,
  CommissionSnapshot,
} from './schema/payment-transaction.schema';

import { Customer, CustomerDocument } from '../customer/schema/customer.schema';
import { Ride, RideDocument } from '../ride/schema/ride.schema';
import { RideStatus } from 'src/common/enums/ride/ride-status.enum';

import { UsaepayService } from './usaepay.service';
import { AddCardDto } from './dto/add-card.dto';
import { ChargeRideDto, RefundTransactionDto, PaymentQueryDto } from './dto/payment.dto';

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
}
