import { apiClient } from './api/core/httpClient';
import type { Goal, CreateGoalRequest, UpdateGoalRequest, JobGoalsSummary, UserGoalsSummary } from '../types/goal';

const BASE_PATH = '/Goal';

export const goalService = {
  async createGoal(data: CreateGoalRequest): Promise<Goal> {
    console.log('[goalService] createGoal called with:', { jobId: data.jobId, title: data.title, deadline: data.deadline });
    const response = await apiClient.post<Goal>(`${BASE_PATH}/create`, data);
    console.log('[goalService] createGoal response:', response.data);
    return response.data;
  },

  async updateGoal(goalId: string, data: UpdateGoalRequest): Promise<Goal> {
    console.log('[goalService] updateGoal called:', { goalId, data });
    const response = await apiClient.put<Goal>(`${BASE_PATH}/${goalId}`, data);
    console.log('[goalService] updateGoal response:', response.data);
    return response.data;
  },

  async deleteGoal(goalId: string): Promise<void> {
    console.log('[goalService] deleteGoal called:', goalId);
    await apiClient.delete(`${BASE_PATH}/${goalId}`);
    console.log('[goalService] deleteGoal completed');
  },

  async completeGoal(goalId: string): Promise<Goal> {
    console.log('[goalService] completeGoal called:', goalId);
    const response = await apiClient.post<Goal>(`${BASE_PATH}/${goalId}/complete`);
    console.log('[goalService] completeGoal response:', response.data);
    return response.data;
  },

  async voteGoalComplete(goalId: string): Promise<Goal> {
    console.log('[goalService] voteGoalComplete called:', goalId);
    const response = await apiClient.post<Goal>(`${BASE_PATH}/${goalId}/vote`);
    console.log('[goalService] voteGoalComplete response:', response.data);
    return response.data;
  },

  async forceCompleteGoal(goalId: string): Promise<Goal> {
    console.log('[goalService] forceCompleteGoal called:', goalId);
    const response = await apiClient.post<Goal>(`${BASE_PATH}/${goalId}/force-complete`);
    console.log('[goalService] forceCompleteGoal response:', response.data);
    return response.data;
  },

  async reopenGoal(goalId: string): Promise<Goal> {
    const response = await apiClient.post<Goal>(`${BASE_PATH}/${goalId}/reopen`);
    return response.data;
  },

  async getGoal(goalId: string): Promise<Goal> {
    const response = await apiClient.get<Goal>(`${BASE_PATH}/${goalId}`);
    return response.data;
  },

  async getJobGoals(jobId: string, status?: string): Promise<Goal[]> {
    const params = status ? `?status=${status}` : '';
    console.log('[goalService] getJobGoals called:', { jobId, status });
    const response = await apiClient.get<Goal[]>(`${BASE_PATH}/job/${jobId}${params}`);
    console.log('[goalService] getJobGoals response:', response.data?.length || 0, 'goals');
    return response.data;
  },

  async getJobGoalsSummary(jobId: string): Promise<JobGoalsSummary> {
    const response = await apiClient.get<JobGoalsSummary>(`${BASE_PATH}/job/${jobId}/summary`);
    return response.data;
  },

  async getMyGoals(status?: string): Promise<Goal[]> {
    const params = status ? `?status=${status}` : '';
    const response = await apiClient.get<Goal[]>(`${BASE_PATH}/my-goals${params}`);
    return response.data;
  },

  async getMyGoalsSummary(): Promise<UserGoalsSummary> {
    const response = await apiClient.get<UserGoalsSummary>(`${BASE_PATH}/my-goals/summary`);
    return response.data;
  },

  async bulkCreateGoals(jobId: string, goals: CreateGoalRequest[]): Promise<Goal[]> {
    console.log('[goalService] bulkCreateGoals called:', { jobId, count: goals.length });
    const response = await apiClient.post<Goal[]>(`${BASE_PATH}/job/${jobId}/bulk`, goals);
    console.log('[goalService] bulkCreateGoals response:', response.data?.length || 0, 'goals created');
    return response.data;
  },
};
