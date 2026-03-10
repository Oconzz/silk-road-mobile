import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { permissionService, PermissionKeys, type PermissionKey } from '../services/api/domain/permissions/permissionService';
import { useAuth } from './AuthContext';

interface PermissionContextType {
  permissions: string[];
  loading: boolean;
  error: string | null;
  
  // Check if user has a specific permission
  hasPermission: (permissionKey: PermissionKey | string) => boolean;
  
  // Check if user has any of the given permissions
  hasAnyPermission: (permissionKeys: (PermissionKey | string)[]) => boolean;
  
  // Check if user has all of the given permissions
  hasAllPermissions: (permissionKeys: (PermissionKey | string)[]) => boolean;
  
  // Reload permissions from server
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

interface PermissionProviderProps {
  children: ReactNode;
}

export const PermissionProvider: React.FC<PermissionProviderProps> = ({ children }) => {
  const { isAuthenticated, currentCompany } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load permissions when authenticated and company is selected
  const refreshPermissions = useCallback(async () => {
    if (!isAuthenticated || !currentCompany) {
      setPermissions([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const userPermissions = await permissionService.getMyPermissions();
      setPermissions(userPermissions);
    } catch (err: any) {
      console.error('[PermissionContext] Error loading permissions:', err);
      setError(err.message || 'Failed to load permissions');
      // On error, set empty permissions - user will have minimal access
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentCompany]);

  // Auto-load permissions when auth state changes
  useEffect(() => {
    if (isAuthenticated && currentCompany) {
      refreshPermissions();
    } else {
      setPermissions([]);
    }
  }, [isAuthenticated, currentCompany?.companyId, refreshPermissions]);

  // Check if user has a specific permission
  const hasPermission = useCallback((permissionKey: PermissionKey | string): boolean => {
    // Admin/SuperAdmin have all permissions by default (handled by backend)
    // This is a client-side check for UI purposes
    return permissions.includes(permissionKey);
  }, [permissions]);

  // Check if user has any of the given permissions
  const hasAnyPermission = useCallback((permissionKeys: (PermissionKey | string)[]): boolean => {
    return permissionKeys.some(key => permissions.includes(key));
  }, [permissions]);

  // Check if user has all of the given permissions
  const hasAllPermissions = useCallback((permissionKeys: (PermissionKey | string)[]): boolean => {
    return permissionKeys.every(key => permissions.includes(key));
  }, [permissions]);

  const value: PermissionContextType = {
    permissions,
    loading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions,
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};

// Re-export PermissionKeys for convenience
export { PermissionKeys };
export type { PermissionKey };
