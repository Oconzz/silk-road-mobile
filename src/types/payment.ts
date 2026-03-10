/**
 * Payment types for Square payment integration
 */

export interface Payment {
  id: string;
  jobId: string;
  userId?: string;
  companyId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod?: string;
  cardBrand?: string;
  lastFourDigits?: string;
  notes?: string;
  failureReason?: string;
  squarePaymentId?: string;
  squareTransactionId?: string;
  squarePaymentLinkId?: string;
  squarePaymentLinkUrl?: string;
  squareOrderId?: string;
  createDatetime: string;
  completedDatetime?: string;
  updateDatetime?: string;
  jobTitle?: string;
  jobNumber?: string;
}

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface SquareConnectionStatus {
  isLinked: boolean;
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

export interface PaymentHistory {
  payments: Payment[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Square POS callback data parsed from deep link
 */
export interface SquarePosCallbackData {
  paymentId: string;
  status: 'success' | 'error' | 'cancel';
  squarePaymentId?: string;
  squareTransactionId?: string;
  errorCode?: string;
  errorDescription?: string;
  cardBrand?: string;
  lastFourDigits?: string;
}
