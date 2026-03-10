// Authentication domain service
import { api, API_BASE_URL } from '../../core/httpClient';
import { BaseApiService } from '../../core/baseService';
import { StorageService, ErrorUtils } from '../../shared/utils';
import type {
  LoginVM,
  RegisterVM,
} from '../../../../types/apiRequests';
import type {
  LoginRM,
  CompanyAssignment,
} from '../../../../types/apiResponses';

export class AuthService extends BaseApiService {
  protected readonly baseUrl = '/Authorization';

  async login(credentials: LoginVM): Promise<LoginRM> {
    try {
      const response = await api.post<LoginRM>(
        `${this.baseUrl}/Login`,
        credentials
      );
      
      if (response.errorMessage) {
        throw new Error(response.errorMessage);
      }

      // Store auth data
      await StorageService.setAuthData({
        token: response.token,
        userId: response.userId,
        email: response.email,
        tokenExpiration: response.tokenExpiration,
        companies: response.companies,
      });

      // Store the server URL that issued this token
      await StorageService.setAuthServerUrl(API_BASE_URL);

      return response;
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(ErrorUtils.getErrorMessage(error));
    }
  }

  async register(data: RegisterVM): Promise<LoginRM> {
    try {
      const response = await api.post<LoginRM>(
        `${this.baseUrl}/Register`,
        data
      );
      
      if (response.errorMessage) {
        throw new Error(response.errorMessage);
      }

      // Store auth data
      await StorageService.setAuthData({
        token: response.token,
        userId: response.userId,
        email: response.email,
        tokenExpiration: response.tokenExpiration,
        companies: response.companies,
      });

      // Store the server URL that issued this token
      await StorageService.setAuthServerUrl(API_BASE_URL);

      return response;
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(ErrorUtils.getErrorMessage(error));
    }
  }

  async logout(): Promise<void> {
    try {
      // TODO: Call logout endpoint if needed
      // await api.post(`${this.baseUrl}/Logout`);
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with local logout even if API call fails
    } finally {
      // Always clear local data
      await StorageService.clearAuthData();
    }
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/ForgotPassword`, { email });
    } catch (error: any) {
      console.error('Forgot password error:', error);
      throw new Error(ErrorUtils.getErrorMessage(error));
    }
  }

  async resetPassword(data: {
    token: string;
    newPassword: string;
  }): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/ResetPassword`, data);
    } catch (error: any) {
      console.error('Reset password error:', error);
      throw new Error(ErrorUtils.getErrorMessage(error));
    }
  }

  async changePassword(newPassword: string): Promise<void> {
    try {
      await api.post(`${this.baseUrl}/ChangePassword`, {
        newPassword,
      });
    } catch (error: any) {
      console.error('Change password error:', error);
      throw new Error(ErrorUtils.getErrorMessage(error));
    }
  }

  async refreshToken(): Promise<LoginRM> {
    try {
      // TODO: Implement refresh token endpoint
      // const response = await api.post<LoginRM>(
      //   `${this.baseUrl}/RefreshToken`,
      //   { refreshToken: await StorageService.getData('@refresh_token') }
      // );
      // return response;
      throw new Error('Refresh token not implemented');
    } catch (error: any) {
      console.error('Token refresh error:', error);
      // Clear auth data on refresh failure
      await StorageService.clearAuthData();
      throw new Error(ErrorUtils.getErrorMessage(error));
    }
  }

  async selectCompany(company: CompanyAssignment): Promise<void> {
    try {
      await StorageService.setData('@auth_currentCompany', company);
    } catch (error: any) {
      console.error('Select company error:', error);
      throw new Error('Failed to select company');
    }
  }

  async getCurrentCompany(): Promise<CompanyAssignment | null> {
    try {
      return await StorageService.getData<CompanyAssignment>('@auth_currentCompany');
    } catch (error: any) {
      console.error('Get current company error:', error);
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const authData = await StorageService.getAuthData();
      
      if (!authData.token) {
        return false;
      }

      // Check if token is expired
      if (authData.tokenExpiration) {
        const expired = new Date() >= new Date(authData.tokenExpiration);
        if (expired) {
          await StorageService.clearAuthData();
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Is authenticated check error:', error);
      return false;
    }
  }
}

// Create singleton instance
export const authService = new AuthService();
