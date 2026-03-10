/**
 * Square Payment Service
 * Handles Square payment integration for collecting payments at job sites
 */

import { api, API_BASE_URL } from '../../core/httpClient';
import { BaseApiService } from '../../core/baseService';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Response types
export interface SquareConnectionStatus {
  isLinked: boolean;
  merchantId?: string;
  locationId?: string;
}

export interface SquareAuthUrl {
  authorizationUrl: string;
}

export interface SquareCallbackResult {
  success: boolean;
  merchantId?: string;
  locationId?: string;
}

export interface PaymentInitiationResult {
  paymentId: string;
  squarePosUrl: string;
  amount: number;
  currency: string;
}

export interface PaymentLinkResult {
  paymentId: string;
  paymentLinkUrl: string;
  amount: number;
  currency: string;
}

export interface Payment {
  id: string;
  jobId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  paymentMethod?: string;
  cardBrand?: string;
  lastFourDigits?: string;
  notes?: string;
  failureReason?: string;
  squarePaymentLinkId?: string;
  squarePaymentLinkUrl?: string;
  squareOrderId?: string;
  createDatetime: string;
  completedDatetime?: string;
  jobTitle?: string;
  jobNumber?: string;
}

export interface PaymentHistory {
  payments: Payment[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Request types
export interface SquareCallbackRequest {
  code: string;
  state?: string;
}

export interface PaymentInitiationRequest {
  jobId: string;
  amount: number;
  notes?: string;
}

export interface PaymentResultRequest {
  paymentId: string;
  status: 'completed' | 'failed' | 'cancelled';
  squarePaymentId?: string;
  squareTransactionId?: string;
  cardBrand?: string;
  lastFourDigits?: string;
  errorMessage?: string;
}

/**
 * Service for managing Square payment integration
 */
export class SquarePaymentService extends BaseApiService {
  protected readonly baseUrl = '/api/SquarePayment';

  /**
   * Get the current user's Square connection status
   */
  async getStatus(): Promise<SquareConnectionStatus> {
    return this.handleRequest(
      () => api.get<SquareConnectionStatus>(`${this.baseUrl}/status`),
      'Failed to get Square status'
    );
  }

  /**
   * Get the OAuth authorization URL to link Square
   */
  async getAuthUrl(): Promise<SquareAuthUrl> {
    return this.handleRequest(
      () => api.get<SquareAuthUrl>(`${this.baseUrl}/auth-url`),
      'Failed to get authorization URL'
    );
  }

  /**
   * Exchange authorization code for tokens after OAuth flow
   */
  async exchangeCode(code: string): Promise<SquareCallbackResult> {
    return this.handleRequest(
      () => api.post<SquareCallbackResult>(`${this.baseUrl}/callback`, { code }),
      'Failed to link Square'
    );
  }

  /**
   * Disconnect Square from the user's account
   */
  async disconnect(): Promise<void> {
    return this.handleRequest(
      () => api.post(`${this.baseUrl}/disconnect`),
      'Failed to disconnect Square'
    );
  }

  /**
   * [SANDBOX ONLY] Link Square with a pre-generated access token
   * Use this for testing when OAuth flow doesn't work in sandbox
   */
  async linkSandboxToken(accessToken: string): Promise<SquareCallbackResult> {
    return this.handleRequest(
      () => api.post<SquareCallbackResult>(`${this.baseUrl}/link-sandbox`, { accessToken }),
      'Failed to link sandbox token'
    );
  }

  /**
   * Initiate a payment - creates a Payment record and returns Square POS deep link URL
   */
  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResult> {
    return this.handleRequest(
      () => api.post<PaymentInitiationResult>(`${this.baseUrl}/initiate`, request),
      'Failed to initiate payment'
    );
  }

  /**
   * Record the result of a payment from Square POS callback
   */
  async recordPaymentResult(request: PaymentResultRequest): Promise<Payment> {
    return this.handleRequest(
      () => api.post<Payment>(`${this.baseUrl}/result`, request),
      'Failed to record payment result'
    );
  }

  /**
   * Get all payments for a specific job
   */
  async getJobPayments(jobId: string): Promise<Payment[]> {
    return this.handleRequest(
      () => api.get<Payment[]>(`${this.baseUrl}/job/${jobId}/payments`),
      'Failed to get job payments'
    );
  }

  /**
   * Create a Square Payment Link - returns a shareable URL
   */
  async createPaymentLink(request: PaymentInitiationRequest): Promise<PaymentLinkResult> {
    return this.handleRequest(
      () => api.post<PaymentLinkResult>(`${this.baseUrl}/create-payment-link`, request),
      'Failed to create payment link'
    );
  }

  /**
   * Check the status of a payment link
   */
  async checkPaymentLinkStatus(paymentId: string): Promise<Payment> {
    return this.handleRequest(
      () => api.get<Payment>(`${this.baseUrl}/payment-link-status/${paymentId}`),
      'Failed to check payment link status'
    );
  }

  /**
   * Get paginated payment history for the current user
   */
  async getPaymentHistory(page: number = 1, pageSize: number = 20): Promise<PaymentHistory> {
    return this.handleRequest(
      () => api.get<PaymentHistory>(`${this.baseUrl}/payments?page=${page}&pageSize=${pageSize}`),
      'Failed to get payment history'
    );
  }

  /**
   * Export payments to CSV file for QuickBooks integration
   * Downloads the CSV to a temp file and returns the file path
   */
  async exportPaymentsCsv(startDate: string, endDate: string, status?: string): Promise<string> {
    const token = await AsyncStorage.getItem('@auth_token');
    const userId = await AsyncStorage.getItem('@auth_userId');
    const currentCompanyStr = await AsyncStorage.getItem('@auth_currentCompany');
    const currentCompany = currentCompanyStr ? JSON.parse(currentCompanyStr) : null;

    let url = `${API_BASE_URL}${this.baseUrl}/export?startDate=${startDate}&endDate=${endDate}`;
    if (status) {
      url += `&status=${status}`;
    }

    const filePath = `${RNFS.TemporaryDirectoryPath}/silkroad-payments-${startDate}-${endDate}.csv`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (userId) headers['X-User-Id'] = userId;
    if (currentCompany?.companyId) headers['X-Company-Id'] = currentCompany.companyId;

    const result = await RNFS.downloadFile({
      fromUrl: url,
      toFile: filePath,
      headers,
    }).promise;

    if (result.statusCode === 404) {
      throw new Error('No payments found for the specified date range');
    }

    if (result.statusCode !== 200) {
      throw new Error(`Export failed with status ${result.statusCode}`);
    }

    return filePath;
  }
}

// Export singleton instance
export const squarePaymentService = new SquarePaymentService();
