// Utility functions for API layer
import AsyncStorage from '@react-native-async-storage/async-storage';

export class StorageKeys {
  static readonly AUTH_TOKEN = '@auth_token';
  static readonly REFRESH_TOKEN = '@refresh_token';
  static readonly USER_ID = '@auth_userId';
  static readonly EMAIL = '@auth_email';
  static readonly TOKEN_EXPIRATION = '@auth_tokenExpiration';
  static readonly COMPANIES = '@auth_companies';
  static readonly CURRENT_COMPANY = '@auth_currentCompany';
  static readonly AUTH_SERVER_URL = '@auth_server_url'; // Track which server issued the token
}

export class StorageService {
  // Auth related storage
  static async setAuthData(data: {
    token: string | null;
    refreshToken?: string;
    userId: string;
    email: string;
    tokenExpiration?: string;
    companies: any[];
  }): Promise<void> {
    // Validate required fields before storing
    if (!data.token) {
      throw new Error('Cannot store auth data: token is required');
    }
    if (!data.userId) {
      throw new Error('Cannot store auth data: userId is required');
    }
    if (!data.email) {
      throw new Error('Cannot store auth data: email is required');
    }

    const promises = [
      AsyncStorage.setItem(StorageKeys.AUTH_TOKEN, data.token),
      AsyncStorage.setItem(StorageKeys.USER_ID, data.userId),
      AsyncStorage.setItem(StorageKeys.EMAIL, data.email),
      AsyncStorage.setItem(StorageKeys.COMPANIES, JSON.stringify(data.companies || [])),
    ];

    if (data.refreshToken) {
      promises.push(AsyncStorage.setItem(StorageKeys.REFRESH_TOKEN, data.refreshToken));
    }

    if (data.tokenExpiration) {
      promises.push(AsyncStorage.setItem(StorageKeys.TOKEN_EXPIRATION, data.tokenExpiration));
    }

    await Promise.all(promises);
  }

  static async clearAuthData(): Promise<void> {
    await AsyncStorage.multiRemove([
      StorageKeys.AUTH_TOKEN,
      StorageKeys.REFRESH_TOKEN,
      StorageKeys.USER_ID,
      StorageKeys.EMAIL,
      StorageKeys.TOKEN_EXPIRATION,
      StorageKeys.COMPANIES,
      StorageKeys.CURRENT_COMPANY,
      StorageKeys.AUTH_SERVER_URL,
    ]);
  }

  /**
   * Check if the token was issued by a different server
   * Returns true if server changed (token should be invalidated)
   */
  static async hasServerChanged(currentServerUrl: string): Promise<boolean> {
    const storedServerUrl = await AsyncStorage.getItem(StorageKeys.AUTH_SERVER_URL);
    if (!storedServerUrl) {
      // No previous server stored, consider it valid
      return false;
    }
    return storedServerUrl !== currentServerUrl;
  }

  /**
   * Store the server URL that issued the current token
   */
  static async setAuthServerUrl(serverUrl: string): Promise<void> {
    await AsyncStorage.setItem(StorageKeys.AUTH_SERVER_URL, serverUrl);
  }

  static async getAuthData(): Promise<{
    token?: string;
    refreshToken?: string;
    userId?: string;
    email?: string;
    tokenExpiration?: string;
    companies?: any[];
    currentCompany?: any;
  }> {
    const [
      token,
      refreshToken,
      userId,
      email,
      tokenExpiration,
      companiesStr,
      currentCompanyStr,
    ] = await Promise.all([
      AsyncStorage.getItem(StorageKeys.AUTH_TOKEN),
      AsyncStorage.getItem(StorageKeys.REFRESH_TOKEN),
      AsyncStorage.getItem(StorageKeys.USER_ID),
      AsyncStorage.getItem(StorageKeys.EMAIL),
      AsyncStorage.getItem(StorageKeys.TOKEN_EXPIRATION),
      AsyncStorage.getItem(StorageKeys.COMPANIES),
      AsyncStorage.getItem(StorageKeys.CURRENT_COMPANY),
    ]);

    return {
      token: token || undefined,
      refreshToken: refreshToken || undefined,
      userId: userId || undefined,
      email: email || undefined,
      tokenExpiration: tokenExpiration || undefined,
      companies: companiesStr ? JSON.parse(companiesStr) : undefined,
      currentCompany: currentCompanyStr ? JSON.parse(currentCompanyStr) : undefined,
    };
  }

  // Generic storage methods
  static async setData<T>(key: string, data: T): Promise<void> {
    // Prevent storing null/undefined values
    if (data === null || data === undefined) {
      console.warn(`[StorageService] Skipping storage of null/undefined for key: ${key}`);
      return;
    }
    await AsyncStorage.setItem(key, JSON.stringify(data));
  }

  static async getData<T>(key: string): Promise<T | null> {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  static async removeData(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }
}

// Validation utilities
export class ValidationUtils {
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s-()]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  static isValidPassword(password: string): boolean {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }
}

// Date utilities
export class DateUtils {
  static formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
  }

  static formatDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString();
  }

  static isExpired(expirationDate: string): boolean {
    return new Date() >= new Date(expirationDate);
  }

  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}

// Error handling utilities
export class ErrorUtils {
  static getErrorMessage(error: any): string {
    // Structured { message: "..." } from our API
    if (error?.response?.data?.message) {
      return error.response.data.message;
    }
    // RFC 7807 ProblemDetails format (ASP.NET ValidationProblem)
    if (error?.response?.data?.detail) {
      return error.response.data.detail;
    }
    if (error?.response?.data?.title) {
      return error.response.data.title;
    }
    // Plain string response
    if (typeof error?.response?.data === 'string' && error.response.data.length > 0) {
      return error.response.data;
    }
    // Standard Error object
    if (error?.message) {
      // Don't show raw axios error messages to user
      if (error.message.includes('status code')) {
        return 'Something went wrong. Please try again.';
      }
      return error.message;
    }
    return 'An unexpected error occurred';
  }

  static isNetworkError(error: any): boolean {
    return !error.response && !!error.request;
  }

  static isAuthError(error: any): boolean {
    return error.response?.status === 401;
  }

  static isForbiddenError(error: any): boolean {
    return error.response?.status === 403;
  }

  static isNotFoundError(error: any): boolean {
    return error.response?.status === 404;
  }

  static isServerError(error: any): boolean {
    const status = error.response?.status;
    return status && status >= 500 && status < 600;
  }
}
