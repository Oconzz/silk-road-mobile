import { apiClient } from '../../core/httpClient';

// Types
export interface PermissionDefinition {
  key: string;
  name: string;
  category: string;
  description: string;
}

export interface PermissionCategory {
  name: string;
  permissions: PermissionDefinition[];
}

export interface AvailablePermissionsResponse {
  categories: PermissionCategory[];
}

export interface UserPermissionStatus {
  permissionKey: string;
  permissionName: string;
  category: string;
  granted: boolean;
  isDefault: boolean;
  grantedDatetime?: string;
  grantedByUserName?: string;
}

export interface UserPermissionsResponse {
  userId: string;
  userFullName: string;
  userEmail: string;
  role: string;
  permissions: UserPermissionStatus[];
}

export interface UpdatePermissionRequest {
  userId: string;
  permissionKey: string;
  granted: boolean;
}

export interface PermissionUpdate {
  permissionKey: string;
  granted: boolean;
}

export interface UpdatePermissionsRequest {
  userId: string;
  permissions: PermissionUpdate[];
}

// Permission keys constants (mirror backend)
export const PermissionKeys = {
  // Inventory
  ViewInventory: 'inventory.view',
  ManageInventory: 'inventory.manage',
  
  // Estimates
  ViewEstimates: 'estimates.view',
  CreateEstimates: 'estimates.create',
  EditEstimates: 'estimates.edit',
  
  // Clients
  ViewClients: 'clients.view',
  ManageClients: 'clients.manage',
  
  // Jobs
  ViewAllJobs: 'jobs.view_all',
  CreateJobs: 'jobs.create',
  EditJobs: 'jobs.edit',
  AssignTeamMembers: 'jobs.assign_team',
  ManageJobStatus: 'jobs.manage_status',
  
  // Financial
  ViewCosts: 'financial.view_costs',
  ViewMargins: 'financial.view_margins',
  
  // Team
  ViewTeamMembers: 'team.view',
  InviteTeamMembers: 'team.invite',
  
  // Time tracking
  ViewAllTimeCards: 'timecards.view_all',
  EditTimeCards: 'timecards.edit',
} as const;

export type PermissionKey = typeof PermissionKeys[keyof typeof PermissionKeys];

class PermissionService {
  /**
   * Get all available permission definitions
   */
  async getAvailablePermissions(): Promise<AvailablePermissionsResponse> {
    const response = await apiClient.get<AvailablePermissionsResponse>('/UserPermission/available');
    return response.data;
  }

  /**
   * Get all permissions for a specific user (Admin only)
   */
  async getUserPermissions(userId: string): Promise<UserPermissionsResponse> {
    const response = await apiClient.get<UserPermissionsResponse>(`/UserPermission/user/${userId}`);
    return response.data;
  }

  /**
   * Get my own permissions
   */
  async getMyPermissions(): Promise<string[]> {
    const response = await apiClient.get<string[]>('/UserPermission/my-permissions');
    return response.data;
  }

  /**
   * Update a single permission for a user (Admin only)
   */
  async updatePermission(request: UpdatePermissionRequest): Promise<void> {
    await apiClient.post('/UserPermission/update', request);
  }

  /**
   * Update multiple permissions for a user (Admin only)
   */
  async updatePermissions(request: UpdatePermissionsRequest): Promise<void> {
    await apiClient.post('/UserPermission/update-multiple', request);
  }

  /**
   * Reset all permissions to role defaults (Admin only)
   */
  async resetPermissions(userId: string): Promise<void> {
    await apiClient.post(`/UserPermission/reset/${userId}`);
  }
}

export const permissionService = new PermissionService();
