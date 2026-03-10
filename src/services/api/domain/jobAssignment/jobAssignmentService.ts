import { api } from '../../core/httpClient';
import type { PagedResponse } from '../../../../types/apiResponses';

export interface AssignedTeamMember {
  userId: string;
  fullName: string;
  email: string;
  photoThumbnail?: string;
  role: string;
  assignedDatetime: string;
}

export interface JobAssignment {
  id: string;
  jobId: string;
  jobTitle: string;
  jobStatus: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhoto?: string;
  role: string;
  notes?: string;
  active: boolean;
  assignedDatetime: string;
  unassignedDatetime?: string;
  assignedByUserName: string;
}

export interface JobAssignmentListItem {
  id: string;
  jobId: string;
  jobTitle: string;
  userId: string;
  userName: string;
  userPhotoThumbnail?: string;
  role: string;
  active: boolean;
  assignedDatetime: string;
}

export interface AssignTeamMemberRequest {
  jobId: string;
  userId: string;
  notes?: string;
}

export interface UnassignTeamMemberRequest {
  jobId: string;
  userId: string;
}

export interface JobAssignmentListRequest {
  jobId?: string;
  userId?: string;
  active?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

export interface UserJobsRequest {
  pageNumber?: number;
  pageSize?: number;
  status?: string;
  searchTerm?: string;
}

export interface JobListItem {
  id: string;
  companyId: string;
  title: string;
  status: string;
  clientName: string;
  locationCity: string;
  createDatetime: string;
}

class JobAssignmentService {
  /**
   * Assign a team member to a job (Admin/Leader only)
   */
  async assignTeamMember(request: AssignTeamMemberRequest): Promise<JobAssignment> {
    return api.post<JobAssignment>('/JobAssignment/assign', request);
  }

  /**
   * Unassign a team member from a job (Admin/Leader only)
   */
  async unassignTeamMember(request: UnassignTeamMemberRequest): Promise<{ message: string }> {
    return api.post<{ message: string }>('/JobAssignment/unassign', request);
  }

  /**
   * Get all team members assigned to a specific job
   */
  async getJobAssignments(jobId: string): Promise<AssignedTeamMember[]> {
    return api.get<AssignedTeamMember[]>(`/JobAssignment/job/${jobId}`);
  }

  /**
   * Get jobs assigned to the current user (for non-admin users)
   */
  async getMyAssignedJobs(request: UserJobsRequest = {}): Promise<PagedResponse<JobListItem>> {
    return api.post<PagedResponse<JobListItem>>('/JobAssignment/my-jobs', {
      pageNumber: request.pageNumber || 1,
      pageSize: request.pageSize || 50,
      status: request.status,
      searchTerm: request.searchTerm,
    });
  }

  /**
   * Get all assignments with optional filters (Admin/Leader only)
   */
  async getAssignments(request: JobAssignmentListRequest = {}): Promise<PagedResponse<JobAssignmentListItem>> {
    return api.post<PagedResponse<JobAssignmentListItem>>('/JobAssignment/list', {
      jobId: request.jobId,
      userId: request.userId,
      active: request.active ?? true,
      pageNumber: request.pageNumber || 1,
      pageSize: request.pageSize || 50,
    });
  }

  /**
   * Check if current user is assigned to a job
   */
  async checkAssignment(jobId: string): Promise<{ isAssigned: boolean }> {
    return api.get<{ isAssigned: boolean }>(`/JobAssignment/check/${jobId}`);
  }
}

export const jobAssignmentService = new JobAssignmentService();
