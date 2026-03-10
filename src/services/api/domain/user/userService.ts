import { api } from '../../core/httpClient';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  active: boolean;
  verified?: boolean;
  createDatetime: string;
  updateDatetime: string;
  personalPhoto?: string;
  personalPhotoThumbnail?: string;
  companyAssignments: UserCompanyAssignment[];
}

export interface UserCompanyAssignment {
  companyId: string;
  companyName: string;
  role: string;
  assignedDatetime: string;
}

export interface UpdateUserRequest {
  id: string;
  fullName?: string;
  email?: string;
  password?: string;
  phone?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  personalPhotoBase64?: string;
}

class UserService {
  /**
   * Get the current user's profile
   */
  async getMyProfile(): Promise<UserProfile> {
    console.log('[UserService] Getting my profile');
    return api.get<UserProfile>('/User/me');
  }

  /**
   * Update user profile
   */
  async updateProfile(request: UpdateUserRequest): Promise<UserProfile> {
    console.log('[UserService] Updating profile:', { id: request.id, hasPhoto: !!request.personalPhotoBase64 });
    return api.post<UserProfile>('/User/userUpdate', request);
  }
}

export const userService = new UserService();
