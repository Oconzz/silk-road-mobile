import { apiClient } from './api/core/httpClient';
import type {
  CreateJobVM,
  UpdateJobVM,
  JobListRequestVM,
  CreateJobInventoryVM,
} from '../types/apiRequests';
import type {
  JobRM,
  JobListItem,
  JobInventoryRM,
  PagedResponse,
} from '../types/apiResponses';

export class JobService {
  private readonly baseUrl = '/Job';

  async getJobList(
    request: JobListRequestVM = {}
  ): Promise<PagedResponse<JobListItem>> {
    try {
      const response = await apiClient.post<PagedResponse<JobListItem>>(
        `${this.baseUrl}/list`,
        request
      );
      return response.data;
    } catch (error: any) {
      console.error('Error fetching job list:', error);
      throw error;
    }
  }

  async getJobById(id: string): Promise<JobRM> {
    try {
      const response = await apiClient.get<JobRM>(`${this.baseUrl}/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching job:', error);
      throw error;
    }
  }

  async createJob(data: CreateJobVM): Promise<JobRM> {
    try {
      const response = await apiClient.post<JobRM>(
        `${this.baseUrl}/create`,
        data
      );
      return response.data;
    } catch (error: any) {
      console.error('Error creating job:', error);
      throw error;
    }
  }

  async updateJob(data: UpdateJobVM): Promise<JobRM> {
    try {
      const response = await apiClient.put<JobRM>(
        `${this.baseUrl}/update`,
        data
      );
      return response.data;
    } catch (error: any) {
      console.error('Error updating job:', error);
      throw error;
    }
  }

  async deleteJob(id: string): Promise<void> {
    try {
      await apiClient.delete(`${this.baseUrl}/${id}`);
    } catch (error: any) {
      console.error('Error deleting job:', error);
      throw error;
    }
  }

  // Helper method to update job status
  async updateJobStatus(jobId: string, status: string): Promise<JobRM> {
    try {
      return await this.updateJob({
        id: jobId,
        status,
      });
    } catch (error: any) {
      console.error('Error updating job status:', error);
      throw error;
    }
  }

  // Helper method to add inventory to job
  async addInventoryToJob(
    jobId: string,
    inventoryItems: CreateJobInventoryVM[]
  ): Promise<JobRM> {
    try {
      // First get the current job
      const job = await this.getJobById(jobId);
      
      // Add new inventory items to existing ones
      const updatedJobInventory = [
        ...(job.jobInventory || []).map(item => ({
          inventoryId: item.inventoryId,
          quantityRequested: item.quantityRequested,
          quantityActual: item.quantityActual,
        })),
        ...inventoryItems,
      ];

      // Update the job with the merged inventory
      return await this.updateJob({
        id: jobId,
        jobInventory: updatedJobInventory,
      } as any);
    } catch (error: any) {
      console.error('Error adding inventory to job:', error);
      throw error;
    }
  }

  // Helper method to get jobs by status
  async getJobsByStatus(status: string): Promise<JobListItem[]> {
    try {
      const response = await this.getJobList({
        status,
        pageSize: 100, // Adjust based on expected volume
      });
      return response.items;
    } catch (error: any) {
      console.error('Error fetching jobs by status:', error);
      throw error;
    }
  }

  // Helper method to get jobs by client
  async getJobsByClient(clientId: string): Promise<JobListItem[]> {
    try {
      const response = await this.getJobList({
        clientId,
        pageSize: 100,
      });
      return response.items;
    } catch (error: any) {
      console.error('Error fetching jobs by client:', error);
      throw error;
    }
  }

  // Job status constants
  static readonly STATUS = {
    DRAFT: 'draft',
    SCHEDULED: 'scheduled',
    IN_PROGRESS: 'in_progress',
    ON_HOLD: 'on_hold',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  } as const;

  // Helper method to get status display text
  static getStatusDisplayText(status: string): string {
    const statusMap: Record<string, string> = {
      draft: 'Draft',
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      on_hold: 'On Hold',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return statusMap[status] || status;
  }
}

// Create singleton instance
export const jobService = new JobService();
