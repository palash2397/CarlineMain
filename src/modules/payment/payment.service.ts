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
      let result = await this.usaepay.addCardToCustomer(
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

      // Auto-heal: If source key not found (key belongs to another gateway/sandbox account), re-create vault
      if (
        !result.success &&
        result.error &&
        /source key not found|not found/i.test(result.error)
      ) {
        this.logger.warn(
          `Customer vault key ${customer.usaepayCustomerId} not found on active gateway for userId=${userId}. Re-creating customer vault...`,
        );
        const newVault = await this.usaepay.createOrUpdateCustomer({
          email: customer.email || undefined,
          name: customer.fullName || undefined,
        });

        if (newVault.success && newVault.customerKey) {
          customer.usaepayCustomerId = newVault.customerKey;
          await customer.save();

          result = await this.usaepay.addCardToCustomer(newVault.customerKey, {
            cardNumber: dto.cardNumber,
            cardExpiration: dto.cardExpiration,
            cardCode: dto.cardCode,
            billingName: dto.billingName,
            billingAddress: dto.billingAddress,
            billingCity: dto.billingCity,
            billingState: dto.billingState,
            billingZip: dto.billingZip,
            billingCountry: dto.billingCountry || 'US',
          });
        }
      }

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
   * Get payment transaction history for a driver.
   */
  async driverTransactions(
    driverId: string,
    query: PaymentQueryDto & { status?: string; paymentMethod?: string },
  ) {
    try {
      const page = query.page || 1;
      const limit = query.limit || 20;

      const filter: any = { driverId };
      if (query.status) filter.status = query.status;
      if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;

      const [items, total, agg] = await Promise.all([
        this.txModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        this.txModel.countDocuments(filter),
        this.txModel.aggregate([
          { $match: { driverId, status: PaymentTransactionStatus.SUCCESS } },
          {
            $group: {
              _id: null,
              totalFare: { $sum: '$amount' },
              totalDriverEarnings: { $sum: '$commissionSnapshot.driverEarnings' },
            },
          },
        ]),
      ]);

      const summary = agg[0] || { totalFare: 0, totalDriverEarnings: 0 };

      return new ApiResponse(
        200,
        {
          items: items.map((tx) => this.txPayload(tx)),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          summary: {
            totalSuccessfulTrips: total,
            totalFare: Number((summary.totalFare || 0).toFixed(2)),
            totalDriverEarnings: Number((summary.totalDriverEarnings || 0).toFixed(2)),
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

      let userDoc: any = null;
      try {
        if (Types.ObjectId.isValid(userId)) {
          userDoc = await this.customerModel.db
            .collection('users')
            .findOne({ _id: new Types.ObjectId(userId) });
        }
      } catch (e) {
        // Ignore user lookup error
      }

      const fullName = userDoc
        ? `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim() ||
          userDoc.email?.split('@')[0] ||
          'Carline Passenger'
        : 'Carline Passenger';

      customer = new this.customerModel({
        customerId: newCustomerId,
        accountNumber: userId,
        fullName,
        email: userDoc?.email || null,
        mobileNumber: userDoc?.phoneNumber || null,
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
        this.logger.error(
          `Failed to create USAePay customer vault for userId=${userId}: ${result.error}`,
        );
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
