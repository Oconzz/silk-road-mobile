import { apiClient } from './api/core/httpClient';
import type {
  LoginVM,
  RegisterVM,
} from '../types/apiRequests';
import type {
  LoginRM,
} from '../types/apiResponses';

export class AuthService {
  private readonly baseUrl = '/Authorization';

  async login(credentials: LoginVM): Promise<LoginRM> {
    try {
      const response = await apiClient.post<LoginRM>(
        `${this.baseUrl}/Login`,
        credentials
      );
      
      if (response.data.errorMessage) {
        throw new Error(response.data.errorMessage);
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async register(data: RegisterVM): Promise<LoginRM> {
    try {
      const response = await apiClient.post<LoginRM>(
        `${this.baseUrl}/Register`,
        data
      );
      
      if (response.data.errorMessage) {
        throw new Error(response.data.errorMessage);
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async refreshToken(): Promise<LoginRM> {
    // TODO: Implement refresh token endpoint
    // const response = await apiClient.post<LoginRM>(
    //   `${this.baseUrl}/RefreshToken`,
    //   { refreshToken: await AsyncStorage.getItem('@refresh_token') }
    // );
    // return response.data;
    throw new Error('Refresh token not implemented');
  }

  async logout(): Promise<void> {
    try {
      // TODO: Call logout endpoint if needed
      // await api.post(`${this.baseUrl}/Logout`);
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with local logout even if API call fails
    }
  }

  async forgotPassword(email: string): Promise<void> {
    // TODO: Implement forgot password endpoint
    // await api.post(`${this.baseUrl}/ForgotPassword`, { email });
    throw new Error('Forgot password not implemented');
  }

  async resetPassword(data: {
    token: string;
    email: string;
    password: string;
    confirmPassword: string;
  }): Promise<void> {
    // TODO: Implement reset password endpoint
    // await api.post(`${this.baseUrl}/ResetPassword`, data);
    throw new Error('Reset password not implemented');
  }
}

// Create singleton instance
export const authService = new AuthService();
