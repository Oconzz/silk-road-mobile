import { api } from '../../core/httpClient';
import type { PagedResponse } from '../../../../types/apiResponses';

export interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  personalPhoto?: string;
  personalPhotoThumbnail?: string;
  joinedDate: string;
  active: boolean;
  activeJobsCount?: number;
  completedJobsCount?: number;
}

export interface InviteTeamMemberRequest {
  email: string;
  fullName: string;
  role: string;
  phone?: string;
}

export interface InviteTeamMemberResponse {
  success: boolean;
  message: string;
  userId?: string;
  email?: string;
  fullName?: string;
  temporaryPassword?: string;
  isNewUser?: boolean;
}

export interface UpdateTeamMemberRoleRequest {
  userId: string;
  role: string;
}

export interface TeamMemberListRequest {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
  role?: string;
  active?: boolean;
}

class TeamService {
  /**
   * Get list of team members for the current company
   */
  async getTeamMembers(request: TeamMemberListRequest = {}): Promise<PagedResponse<TeamMember>> {
    return api.post<PagedResponse<TeamMember>>('/Team/list', {
      pageNumber: request.pageNumber || 1,
      pageSize: request.pageSize || 50,
      searchTerm: request.searchTerm,
      role: request.role,
      active: request.active ?? true,
    });
  }

  /**
   * Get a single team member's details
   */
  async getTeamMember(userId: string): Promise<TeamMember> {
    return api.get<TeamMember>(`/Team/${userId}`);
  }

  /**
   * Invite a new team member to the company
   */
  async inviteTeamMember(request: InviteTeamMemberRequest): Promise<InviteTeamMemberResponse> {
    return api.post<InviteTeamMemberResponse>('/Team/invite', request);
  }

  /**
   * Update a team member's role
   */
  async updateTeamMemberRole(request: UpdateTeamMemberRoleRequest): Promise<{ message: string }> {
    return api.put<{ message: string }>('/Team/role', request);
  }

  /**
   * Remove a team member from the company
   */
  async removeTeamMember(userId: string): Promise<{ message: string }> {
    await api.delete(`/Team/${userId}`);
    return { message: 'Team member removed successfully' };
  }
}

export const teamService = new TeamService();
