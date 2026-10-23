import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

export interface USAePayCard {
  cardNumber: string;
  cardExpiration: string; // MMYY format
  cardCode?: string;       // CVV
  billingName?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  billingCountry?: string;
}

export interface USAePayChargeResult {
  success: boolean;
  transactionKey?: string;
  authCode?: string;
  refNum?: string;
  result?: string;
  error?: string;
  rawResponse?: any;
}

export interface USAePayRefundResult {
  success: boolean;
  transactionKey?: string;
  refNum?: string;
  error?: string;
  rawResponse?: any;
}

export interface USAePayCustomerResult {
  success: boolean;
  customerKey?: string;
  payMethodKey?: string;
  cardLast4?: string;
  cardBrand?: string;
  error?: string;
}

export interface USAePaySavedCard {
  payMethodKey: string;
  cardLast4: string;
  cardBrand: string;
  cardExpiration: string;
  isDefault: boolean;
}

/**
 * Core USAePay API service.
 * Handles authentication (HMAC-SHA256), card tokenization (customer vault),
 * charge, refund, void, and saved card management.
 */
@Injectable()
export class UsaepayService {
  private readonly logger = new Logger(UsaepayService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly pin: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('USAEPAY_API_KEY', '');
    this.pin = this.config.get<string>('USAEPAY_API_PIN', '');
    const baseURL = this.config.get<string>(
      'USAEPAY_BASE_URL',
      'https://sandbox.usaepay.com/api/v2',
    );

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Attach auth header to every request
    this.client.interceptors.request.use((reqConfig) => {
      reqConfig.headers['Authorization'] = this.buildAuthHeader();
      return reqConfig;
    });
  }

  // ============================================================
  // Auth Header — SHA-256
  // USAePay requires: "Basic base64(apiKey:s2/seed/hash)"
  // prehash = apiKey + seed + pin
  // ============================================================
  private buildAuthHeader(): string {
    const seed = Math.random().toString(36).substring(2, 12);
    const prehash = `${this.apiKey}${seed}${this.pin}`;
    const hash = crypto
      .createHash('sha256')
      .update(prehash)
      .digest('hex');

    const apiHash = `s2/${seed}/${hash}`;
    const token = Buffer.from(`${this.apiKey}:${apiHash}`).toString('base64');
    return `Basic ${token}`;
  }

  // ============================================================
  // Customer Vault — Create or fetch customer
  // ============================================================
  async createOrUpdateCustomer(params: {
    email?: string;
    name?: string;
    customerId?: string; // existing USAePay customer key to update
  }): Promise<{ success: boolean; customerKey?: string; error?: string }> {
    try {
      const nameParts = (params.name || 'Carline Customer').trim().split(/\s+/);
      const firstname = nameParts[0] || 'Carline';
      const lastname = nameParts.slice(1).join(' ') || 'User';

      const payload: any = {
        firstname,
        lastname,
        company: 'Carline',
        email: params.email || '',
        description: params.name || 'Carline Customer',
      };

      let response: any;

      if (params.customerId) {
        // Update existing
        response = await this.client.put(
          `/customers/${params.customerId}`,
          payload,
        );
      } else {
        // Create new
        response = await this.client.post('/customers', payload);
      }

      const data = response.data;

      if (data?.key) {
        return { success: true, customerKey: data.key };
      }

      return {
        success: false,
        error: data?.error || 'Failed to create customer vault',
      };
    } catch (err: any) {
      const error = err?.response?.data?.error || err.message || 'USAePay API error';
      this.logger.error(`createOrUpdateCustomer error: ${error}`);
      return { success: false, error };
    }
  }

  // ============================================================
  // Add Card to Customer Vault (Tokenization)
  // ============================================================
  async addCardToCustomer(
    customerKey: string,
    card: USAePayCard,
  ): Promise<USAePayCustomerResult> {
    try {
      const payload: any = {
        command: 'cc:save',
        custkey: customerKey,
        creditcard: {
          cardholder: card.billingName || 'Carline Customer',
          number: card.cardNumber.replace(/\s/g, ''),
          expiration: card.cardExpiration.replace(/\D/g, ''),
          cvc: card.cardCode,
          avs_street: card.billingAddress || '',
          avs_zip: card.billingZip || '',
        },
      };

      const response = await this.client.post('/transactions', payload);
      const data = response.data;

      if (data?.result === 'Approved' || data?.result_code === 'A') {
        const saved = data.savedcard || {};
        const cardNum: string = card.cardNumber.replace(/\s/g, '');
        const last4 = cardNum.slice(-4);
        const brand = this.detectCardBrand(cardNum);

        return {
          success: true,
          customerKey,
          payMethodKey: saved.key || data.key,
          cardLast4: saved.cardnumber ? saved.cardnumber.slice(-4) : last4,
          cardBrand: saved.type || brand,
        };
      }

      return {
        success: false,
        error: data?.error || data?.result || 'Failed to add card to vault',
      };
    } catch (err: any) {
      const error = err?.response?.data?.error || err.message || 'USAePay API error';
      this.logger.error(`addCardToCustomer error: ${error}`);
      return { success: false, error };
    }
  }

  // ============================================================
  // Get Saved Cards for Customer
  // ============================================================
  async getSavedCards(customerKey: string): Promise<USAePaySavedCard[]> {
    try {
      const response = await this.client.get(
        `/customers/${customerKey}/paymentmethods`,
      );
      const data = response.data;

      if (!data?.data || !Array.isArray(data.data)) return [];

      return data.data.map((pm: any) => ({
        payMethodKey: pm.key || '',
        cardLast4: pm.number_masked ? pm.number_masked.slice(-4) : '****',
        cardBrand: pm.card_type || 'Unknown',
        cardExpiration: pm.expiration || '',
        isDefault: Boolean(pm.is_default),
      }));
    } catch (err: any) {
      this.logger.error(`getSavedCards error: ${err.message}`);
      return [];
    }
  }

  // ============================================================
  // Delete a saved card from vault
  // ============================================================
  async deleteCard(
    customerKey: string,
    payMethodKey: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.delete(
        `/customers/${customerKey}/paymentmethods/${payMethodKey}`,
      );
      return { success: true };
    } catch (err: any) {
      const error = err?.response?.data?.error || err.message || 'USAePay API error';
      this.logger.error(`deleteCard error: ${error}`);
      return { success: false, error };
    }
  }

  // ============================================================
  // Charge — Charge using saved customer vault card
  // ============================================================
  async chargeCustomerCard(params: {
    customerKey: string;
    payMethodKey?: string; // if null, charges default card
    amount: number;
    description?: string;
    orderId?: string;
  }): Promise<USAePayChargeResult> {
    try {
      const amountStr = params.amount.toFixed(2);

      const payload: any = {
        command: 'cc:sale',
        amount: amountStr,
        currency: 'USD',
        description: params.description || 'Ride payment',
        invoice: params.orderId || undefined,
        custkey: params.customerKey || undefined,
        creditcard: {
          number: params.payMethodKey,
        },
      };

      const response = await this.client.post('/transactions', payload);
      const data = response.data;

      if (data?.result === 'Approved' || data?.result_code === 'A') {
        return {
          success: true,
          transactionKey: data.key,
          authCode: data.authcode || data.auth_code,
          refNum: data.refnum,
          result: data.result,
          rawResponse: data,
        };
      }

      return {
        success: false,
        error: data?.error || data?.result_text || 'Transaction declined',
        rawResponse: data,
      };
    } catch (err: any) {
      const error = err?.response?.data?.error || err.message || 'USAePay API error';
      this.logger.error(`chargeCustomerCard error: ${error}`);
      return { success: false, error };
    }
  }

  // ============================================================
  // Charge — One-time card charge (no vault)
  // ============================================================
  async chargeCard(params: {
    card: USAePayCard;
    amount: number;
    description?: string;
    orderId?: string;
  }): Promise<USAePayChargeResult> {
    try {
      const amountStr = params.amount.toFixed(2);

      const payload: any = {
        command: 'sale',
        amount: amountStr,
        currency: 'USD',
        description: params.description || 'Ride payment',
        invoice: params.orderId || undefined,
        payment_method: {
          creditcard: {
            number: params.card.cardNumber,
            expiration: params.card.cardExpiration,
            cvc: params.card.cardCode,
            cardholder: params.card.billingName,
          },
        },
        billing_address: {
          name: params.card.billingName || '',
          address: params.card.billingAddress || '',
          city: params.card.billingCity || '',
          state: params.card.billingState || '',
          postalcode: params.card.billingZip || '',
          country: params.card.billingCountry || 'US',
        },
      };

      const response = await this.client.post('/transactions', payload);
      const data = response.data;

      if (data?.result === 'A' || data?.result_code === 'A') {
        return {
          success: true,
          transactionKey: data.key,
          authCode: data.auth_code,
          refNum: data.refnum,
          result: data.result,
          rawResponse: data,
        };
      }

      return {
        success: false,
        error: data?.error || data?.result_text || 'Transaction declined',
        rawResponse: data,
      };
    } catch (err: any) {
      const error = err?.response?.data?.error || err.message || 'USAePay API error';
      this.logger.error(`chargeCard error: ${error}`);
      return { success: false, error };
    }
  }

  // ============================================================
  // Refund
  // ============================================================
  async refundTransaction(params: {
    transactionKey?: string;
    refNum?: string;
    amount?: number; // partial refund; omit for full refund
  }): Promise<USAePayRefundResult> {
    try {
      const targetRef = params.refNum || params.transactionKey;
      if (!targetRef) {
        return { success: false, error: 'No transaction refnum or key provided' };
      }

      // USAePay accepts 'quickrefund' or 'creditvoid' with 'refnum'
      const payload: any = {
        command: params.amount !== undefined ? 'quickrefund' : 'creditvoid',
        refnum: targetRef,
      };

      if (params.amount !== undefined) {
        payload.amount = params.amount.toFixed(2);
      }

      let response = await this.client.post('/transactions', payload);
      let data = response.data;

      // If the sale is not yet settled (same-day / in open batch), refund is not permitted by card networks.
      // Card networks require 'void' for unsettled transactions to release the authorized hold immediately.
      const isUnsettled =
        data?.error?.toLowerCase().includes('not settled') ||
        data?.error_code === '115';

      if (isUnsettled) {
        this.logger.log(
          `Transaction ${targetRef} is not yet settled. Falling back to void...`,
        );
        response = await this.client.post('/transactions', {
          command: 'void',
          refnum: targetRef,
        });
        data = response.data;
      }

      if (
        data?.result === 'A' ||
        data?.result_code === 'A' ||
        data?.result === 'Approved' ||
        data?.error?.toLowerCase().includes('already voided')
      ) {
        return {
          success: true,
          transactionKey: data.key || data.refnum || targetRef,
          refNum: data.refnum || targetRef,
          rawResponse: data,
        };
      }

      return {
        success: false,
        error: data?.error || data?.result_text || data?.result || 'Refund failed',
        rawResponse: data,
      };
    } catch (err: any) {
      const error = err?.response?.data?.error || err.message || 'USAePay API error';
      this.logger.error(`refundTransaction error: ${error}`);
      return { success: false, error };
    }
  }

  // ============================================================
  // Void
  // ============================================================
  async voidTransaction(refNumOrKey: string): Promise<USAePayRefundResult> {
    try {
      const payload = {
        command: 'void',
        refnum: refNumOrKey,
      };

      const response = await this.client.post('/transactions', payload);
      const data = response.data;

      if (data?.result === 'A' || data?.result_code === 'A' || data?.result === 'Approved') {
        return {
          success: true,
          transactionKey: data.key || data.refnum || refNumOrKey,
          refNum: data.refnum || refNumOrKey,
          rawResponse: data,
        };
      }

      return {
        success: false,
        error: data?.error || data?.result_text || data?.result || 'Void failed',
        rawResponse: data,
      };
    } catch (err: any) {
      const error = err?.response?.data?.error || err.message || 'USAePay API error';
      this.logger.error(`voidTransaction error: ${error}`);
      return { success: false, error };
    }
  }

  // ============================================================
  // Get transaction details
  // ============================================================
  async getTransaction(
    transactionKey: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await this.client.get(
        `/transactions/${transactionKey}`,
      );
      return { success: true, data: response.data };
    } catch (err: any) {
      const error = err?.response?.data?.error || err.message || 'USAePay API error';
      this.logger.error(`getTransaction error: ${error}`);
      return { success: false, error };
    }
  }

  // ============================================================
  // Helper: detect card brand from number
  // ============================================================
  private detectCardBrand(cardNumber: string): string {
    const num = cardNumber.replace(/\D/g, '');
    if (/^4/.test(num)) return 'Visa';
    if (/^5[1-5]/.test(num)) return 'Mastercard';
    if (/^3[47]/.test(num)) return 'Amex';
    if (/^6(?:011|5)/.test(num)) return 'Discover';
    if (/^3(?:0[0-5]|[68])/.test(num)) return 'Diners Club';
    if (/^35/.test(num)) return 'JCB';
    return 'Unknown';
  }
}
