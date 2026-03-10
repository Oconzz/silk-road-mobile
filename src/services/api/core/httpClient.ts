import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';
import { StorageService, StorageKeys } from '../shared/utils';

// API base configuration from environment variable
// Set API_URL in .env file:
//   - Local development: http://localhost:5001 (use your machine's IP for physical devices)
//   - Staging: https://staging-api.silkroadapp.com
const rawApiUrl = Config.API_URL || 'https://staging-api.silkroadapp.com';
export const API_BASE_URL = rawApiUrl.split('#')[0].trim();

console.log('[httpClient] API_BASE_URL:', API_BASE_URL, '__DEV__:', __DEV__);

// Flag to track if server change has been checked this session
let serverChangeChecked = false;

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth headers
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      // Check if server has changed (only once per session to avoid performance impact)
      if (!serverChangeChecked) {
        serverChangeChecked = true;
        const serverChanged = await StorageService.hasServerChanged(API_BASE_URL);
        if (serverChanged) {
          console.warn('[httpClient] Server URL changed! Clearing old auth data...');
          console.warn('[httpClient] This usually happens when switching between local/staging/production.');
          console.warn('[httpClient] Please log in again to get a valid token for this server.');
          await StorageService.clearAuthData();
          // Token is now invalid, the request will likely fail with 401
          // which is expected behavior - user needs to re-authenticate
        }
      }

      // Get auth token
      const token = await AsyncStorage.getItem('@auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Get current company ID
      const currentCompanyStr = await AsyncStorage.getItem('@auth_currentCompany');
      if (currentCompanyStr) {
        const currentCompany = JSON.parse(currentCompanyStr);
        if (currentCompany?.companyId) {
          config.headers['X-Company-Id'] = currentCompany.companyId;
        }
      }

      // Get current user ID
      const userId = await AsyncStorage.getItem('@auth_userId');
      if (userId) {
        config.headers['X-User-Id'] = userId;
      }

      // Debug logging
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
      console.log('[API Request] Headers:', {
        Authorization: config.headers.Authorization ? 'Bearer [TOKEN]' : 'MISSING',
        'X-Company-Id': config.headers['X-Company-Id'] || 'MISSING',
        'X-User-Id': config.headers['X-User-Id'] || 'MISSING',
      });
      if (config.data) {
        console.log('[API Request] Body:', JSON.stringify(config.data, null, 2));
      }
    } catch (error) {
      console.error('[API Request] Error in interceptor:', error);
    }

    return config;
  },
  (error) => {
    console.error('[API Request] Interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API Response] ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    console.error(`[API Error] ${error.response?.status || 'NETWORK'} ${error.config?.url}`);
    console.error('[API Error] Response:', error.response?.data);
    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const refreshToken = await AsyncStorage.getItem('@refresh_token');
        if (refreshToken) {
          // TODO: Implement token refresh endpoint
          // const response = await axios.post(`${API_BASE_URL}/Authorization/RefreshToken`, {
          //   refreshToken,
          // });

          // Store new token
          // await AsyncStorage.setItem('@auth_token', response.data.token);

          // Retry original request
          // originalRequest.headers.Authorization = `Bearer ${response.data.token}`;
          // return apiClient(originalRequest);
        }

        // If refresh fails or is not implemented, logout user
        await AsyncStorage.multiRemove([
          '@auth_token',
          '@auth_userId',
          '@auth_email',
          '@auth_tokenExpiration',
          '@auth_companies',
          '@auth_currentCompany',
          '@refresh_token',
        ]);

        // Note: The app should automatically redirect to login because AuthContext 
        // state will change if it's polling or on next app restart. 
        // For immediate redirect, we recommend calling a logout method from context.

        return Promise.reject(error);
      } catch (refreshError) {
        // Refresh failed, clear auth
        await AsyncStorage.multiRemove([
          '@auth_token',
          '@auth_userId',
          '@auth_email',
          '@auth_tokenExpiration',
          '@auth_companies',
          '@auth_currentCompany',
          '@refresh_token',
        ]);

        return Promise.reject(refreshError);
      }
    }

    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error);
      // TODO: Show offline message
    }

    // Handle other HTTP errors
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 400:
          console.error('Bad Request:', data);
          break;
        case 403:
          console.error('Forbidden:', data);
          // TODO: Show permission denied message
          break;
        case 404:
          console.error('Not Found:', data);
          break;
        case 500:
          console.error('Server Error:', data);
          // TODO: Show server error message
          break;
        default:
          console.error(`HTTP Error ${status}:`, data);
      }
    }

    return Promise.reject(error);
  }
);

// Helper methods for specific HTTP methods
export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig) =>
    apiClient.get<T>(url, config).then(response => response.data),

  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiClient.post<T>(url, data, config).then(response => response.data),

  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiClient.put<T>(url, data, config).then(response => response.data),

  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiClient.patch<T>(url, data, config).then(response => response.data),

  delete: <T = any>(url: string, config?: AxiosRequestConfig) =>
    apiClient.delete<T>(url, config).then(response => response.data),
};
