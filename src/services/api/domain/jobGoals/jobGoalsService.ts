import { api } from '../../core/httpClient';

export interface JobGoal {
  id: string;
  jobId: string;
  companyId: string;
  title: string;
  description: string;
  bonusAmount: number;
  targetDate: string;
  completed: boolean;
  completedDate?: string;
  completedBy?: string;
  completedByName?: string;
  requiresVerification: boolean;
  verified: boolean;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedDate?: string;
  media: JobGoalMedia[];
  createDatetime: string;
  updateDatetime: string;
}

export interface JobGoalMedia {
  id: string;
  goalId: string;
  webUrl: string;
  thumbUrl: string;
  createDatetime: string;
}

export interface CreateJobGoalRequest {
  jobId: string;
  title: string;
  description?: string;
  bonusAmount: number;
  targetDate: string;
  requiresVerification?: boolean;
}

export interface UpdateJobGoalRequest {
  id: string;
  title?: string;
  description?: string;
  bonusAmount?: number;
  targetDate?: string;
  requiresVerification?: boolean;
}

export interface CompleteJobGoalRequest {
  goalId: string;
  notes?: string;
}

export interface VerifyJobGoalRequest {
  goalId: string;
  approved: boolean;
  notes?: string;
}

export interface JobGoalListRequest {
  jobId: string;
}

class JobGoalsService {
  /**
   * Get goals for a specific job
   */
  async getJobGoals(request: JobGoalListRequest): Promise<JobGoal[]> {
    return api.post<JobGoal[]>('/JobGoal/list', request);
  }

  /**
   * Get a single goal by ID
   */
  async getGoalById(goalId: string): Promise<JobGoal> {
    return api.get<JobGoal>(`/JobGoal/${goalId}`);
  }

  /**
   * Create a new goal (Admin only)
   */
  async createGoal(request: CreateJobGoalRequest): Promise<JobGoal> {
    return api.post<JobGoal>('/JobGoal/create', request);
  }

  /**
   * Update a goal (Admin only)
   */
  async updateGoal(request: UpdateJobGoalRequest): Promise<JobGoal> {
    return api.put<JobGoal>('/JobGoal/update', request);
  }

  /**
   * Mark goal as complete (Crew can do this)
   */
  async completeGoal(request: CompleteJobGoalRequest): Promise<JobGoal> {
    return api.post<JobGoal>('/JobGoal/complete', request);
  }

  /**
   * Verify a completed goal (Admin/Leader only)
   */
  async verifyGoal(request: VerifyJobGoalRequest): Promise<JobGoal> {
    return api.post<JobGoal>('/JobGoal/verify', request);
  }

  /**
   * Delete a goal (Admin only)
   */
  async deleteGoal(goalId: string): Promise<void> {
    await api.delete(`/JobGoal/${goalId}`);
  }
}

export const jobGoalsService = new JobGoalsService();
