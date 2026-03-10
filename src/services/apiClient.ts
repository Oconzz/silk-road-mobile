import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';

// API base configuration from environment variable
// Set API_URL in .env file (e.g., http://192.168.1.54:5001 for local, https://staging-api.silkroadapp.com for staging)
const API_BASE_URL = Config.API_URL || 'https://staging-api.silkroadapp.com';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
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
    } catch (error) {
      console.error('Error in request interceptor:', error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
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

        // If refresh fails, logout user
        await AsyncStorage.multiRemove([
          '@auth_token',
          '@auth_userId',
          '@auth_email',
          '@auth_tokenExpiration',
          '@auth_companies',
          '@auth_currentCompany',
        ]);

        // TODO: Navigate to login screen
        // navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });

        return Promise.reject(error);
      } catch (refreshError) {
        // Refresh failed, clear auth and redirect to login
        await AsyncStorage.multiRemove([
          '@auth_token',
          '@auth_userId',
          '@auth_email',
          '@auth_tokenExpiration',
          '@auth_companies',
          '@auth_currentCompany',
        ]);

        // TODO: Navigate to login screen
        // navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });

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

// Export the axios instance for advanced usage
export default apiClient;
