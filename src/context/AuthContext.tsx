import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import Config from 'react-native-config';
import { authService } from '../services/api/domain/auth/authService';
import { companyService } from '../services/api/domain/company/companyService';
import { StorageService, StorageKeys, DateUtils } from '../services/api/shared/utils';
import { clearImageCache } from '../services/imageCacheService';
import type {
  LoginVM,
  RegisterVM,
} from '../types/apiRequests';
import type {
  LoginRM,
  CompanyAssignment,
} from '../types/apiResponses';

// ⚠️ DEVELOPMENT BYPASS - Set to true to skip authentication
const BYPASS_AUTH = false;

// Helper to get mock user data from environment variables
const getMockUser = () => {
  // Debug logs to verify Config values
  console.log('[AuthContext] Config values:', {
    BYPASS_AUTH_MODE: Config.BYPASS_AUTH_MODE,
    STAGING_AUTH_TOKEN: Config.STAGING_AUTH_TOKEN ? 'EXISTS' : 'MISSING',
    LOCAL_AUTH_TOKEN: Config.LOCAL_AUTH_TOKEN ? 'EXISTS' : 'MISSING',
  });

  const mode = Config.BYPASS_AUTH_MODE || 'staging';
  console.log(`[AuthContext] Final Bypass mode used: ${mode}`);

  if (mode === 'staging') {
    return {
      userId: Config.STAGING_USER_ID || '',
      email: Config.STAGING_EMAIL || '',
      token: Config.STAGING_AUTH_TOKEN || '',
      tokenExpiration: '2026-04-02T15:20:20.2133667Z',
      companies: [
        {
          companyId: Config.STAGING_COMPANY_ID || '',
          companyName: 'Staging Company',
          role: 'Admin',
          category: 'General Contracting',
        },
      ] as CompanyAssignment[],
    };
  }

  // Local Mode
  return {
    userId: Config.LOCAL_USER_ID || '',
    email: Config.LOCAL_EMAIL || '',
    token: Config.LOCAL_AUTH_TOKEN || '',
    tokenExpiration: '2026-04-02T15:20:20.2133667Z',
    companies: [
      {
        companyId: Config.LOCAL_COMPANY_ID || '',
        companyName: 'Local Company',
        role: 'Admin',
        category: 'General Contracting',
      },
    ] as CompanyAssignment[],
  };
};

const MOCK_USER = getMockUser();

const MOCK_COMPANY: CompanyAssignment = MOCK_USER.companies[0];

interface AuthContextType {
  // Auth state
  isAuthenticated: boolean;
  isLoading: boolean;
  changePasswordRequired: boolean;
  user: {
    userId: string;
    email: string;
    token: string;
    tokenExpiration?: string;
    companies: CompanyAssignment[];
  } | null;

  // Current company context
  currentCompany: CompanyAssignment | null;

  // Actions
  login: (credentials: LoginVM) => Promise<LoginRM>;
  register: (data: RegisterVM) => Promise<LoginRM>;
  changePassword: (newPassword: string) => Promise<void>;
  dismissChangePassword: () => void;
  logout: () => Promise<void>;
  selectCompany: (company: CompanyAssignment) => Promise<void>;
  updateCurrentCompanyCategory: (category: string) => void;
  updateCurrentCompanyLogo: (logo: string | undefined) => void;
  refreshToken: () => Promise<boolean>;

  // Check if token is expired
  isTokenExpired: () => boolean;

  // New registration flag
  isNewRegistration: boolean;
  clearNewRegistration: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [changePasswordRequired, setChangePasswordRequired] = useState(false);
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [currentCompany, setCurrentCompany] = useState<CompanyAssignment | null>(null);
  const [isNewRegistration, setIsNewRegistration] = useState(false);

  // Load stored auth data on app start
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      // ⚠️ BYPASS MODE - Skip authentication entirely
      if (BYPASS_AUTH) {
        console.log('[AuthContext] BYPASS_AUTH enabled - auto-logging in with mock user');

        // ⚠️ IMPORTANT: Store mock token in AsyncStorage so apiClient can use it
        await StorageService.setAuthData({
          token: MOCK_USER.token,
          userId: MOCK_USER.userId,
          email: MOCK_USER.email,
          tokenExpiration: MOCK_USER.tokenExpiration,
          companies: MOCK_USER.companies,
        });

        // Also save the current company
        await StorageService.setData(StorageKeys.CURRENT_COMPANY, MOCK_COMPANY);

        setUser(MOCK_USER);
        setCurrentCompany(MOCK_COMPANY);
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      const authData = await StorageService.getAuthData();

      if (authData.token && authData.userId && authData.email) {
        setUser({
          userId: authData.userId,
          email: authData.email,
          token: authData.token,
          tokenExpiration: authData.tokenExpiration,
          companies: authData.companies || [],
        });

        setCurrentCompany(authData.currentCompany || null);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
      // Clear corrupted data
      await StorageService.clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginVM): Promise<LoginRM> => {
    console.log('[AuthContext] Login started');
    const response = await authService.login(credentials);
    console.log('[AuthContext] Login response:', {
      userId: response.userId,
      email: response.email,
      hasToken: !!response.token,
      companiesCount: response.companies?.length || 0,
      changePasswordRequired: response.changePasswordRequired,
    });

    setUser({
      userId: response.userId,
      email: response.email,
      token: response.token,
      tokenExpiration: response.tokenExpiration,
      companies: response.companies,
    });

    // Check if password change is required (first login for staff)
    if (response.changePasswordRequired) {
      console.log('[AuthContext] Password change required for first login');
      setChangePasswordRequired(true);
    }

    setIsAuthenticated(true);

    // Auto-select first company if none selected
    if (!currentCompany && response.companies && response.companies.length > 0) {
      console.log('[AuthContext] Auto-selecting first company:', response.companies[0]);
      await selectCompany(response.companies[0]);
    }

    return response;
  };

  const changePassword = async (newPassword: string): Promise<void> => {
    console.log('[AuthContext] Changing password');
    await authService.changePassword(newPassword);
    setChangePasswordRequired(false);
    console.log('[AuthContext] Password changed successfully');
  };

  const dismissChangePassword = (): void => {
    console.log('[AuthContext] Dismissing change password modal');
    setChangePasswordRequired(false);
  };

  const register = async (data: RegisterVM): Promise<LoginRM> => {
    console.log('[AuthContext] Register started');
    const response = await authService.register(data);
    console.log('[AuthContext] Register response:', {
      userId: response.userId,
      email: response.email,
      hasToken: !!response.token,
      companiesCount: response.companies?.length || 0,
    });

    setUser({
      userId: response.userId,
      email: response.email,
      token: response.token,
      tokenExpiration: response.tokenExpiration,
      companies: response.companies,
    });

    setIsAuthenticated(true);
    setIsNewRegistration(true);

    // Auto-select first company
    if (response.companies && response.companies.length > 0) {
      console.log('[AuthContext] Auto-selecting first company:', response.companies[0]);
      await selectCompany(response.companies[0]);
    }

    return response;
  };

  const clearNewRegistration = () => {
    setIsNewRegistration(false);
  };

  const logout = async (): Promise<void> => {
    await authService.logout();
    clearImageCache();
    setUser(null);
    setCurrentCompany(null);
    setIsAuthenticated(false);
  };

  const selectCompany = async (company: CompanyAssignment) => {
    console.log('[AuthContext] Selecting company:', company);
    setCurrentCompany(company);
    await authService.selectCompany(company);
    console.log('[AuthContext] Company selected and saved to storage');

    // Fetch company details to get the category (needed for Quick Start Templates)
    try {
      const companyDetails = await companyService.getCompany();
      if (companyDetails?.category) {
        const updatedCompany = { ...company, category: companyDetails.category };
        setCurrentCompany(updatedCompany);
        await StorageService.setData(StorageKeys.CURRENT_COMPANY, updatedCompany);
        console.log('[AuthContext] Company category loaded:', companyDetails.category);
      }
    } catch (error) {
      console.warn('[AuthContext] Failed to fetch company category:', error);
      // Silent fail - category is optional for core functionality
    }
  };

  const updateCurrentCompanyCategory = (category: string) => {
    if (currentCompany) {
      const updated = { ...currentCompany, category };
      setCurrentCompany(updated);
      // Also update in storage
      StorageService.setData(StorageKeys.CURRENT_COMPANY, updated);
      console.log('[AuthContext] Updated currentCompany category to:', category);
    }
  };

  const updateCurrentCompanyLogo = (logo: string | undefined) => {
    if (currentCompany) {
      const updated = { ...currentCompany, companyLogo: logo, companyLogoThumbnail: logo };
      setCurrentCompany(updated);
      StorageService.setData(StorageKeys.CURRENT_COMPANY, updated);
      console.log('[AuthContext] Updated currentCompany logo');
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      await authService.refreshToken();
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  };

  const isTokenExpired = (): boolean => {
    if (!user?.tokenExpiration) return false;

    return DateUtils.isExpired(user.tokenExpiration);
  };

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    changePasswordRequired,
    user,
    currentCompany,
    login,
    register,
    changePassword,
    dismissChangePassword,
    logout,
    selectCompany,
    updateCurrentCompanyCategory,
    updateCurrentCompanyLogo,
    refreshToken,
    isTokenExpired,
    isNewRegistration,
    clearNewRegistration,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
