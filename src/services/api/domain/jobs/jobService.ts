// Jobs domain service
import { api } from '../../core/httpClient';
import { BaseApiService } from '../../core/baseService';
import { ErrorUtils } from '../../shared/utils';
import type {
  CreateJobVM,
  UpdateJobVM,
  JobListRequestVM,
  CreateJobInventoryVM,
  CreateJobMediaVM,
  UpdateJobMediaVM,
} from '../../../../types/apiRequests';
import type {
  JobRM,
  JobListItem,
  JobInventoryRM,
  PagedResponse,
  JobMediaRM,
} from '../../../../types/apiResponses';

export class JobService extends BaseApiService {
  protected readonly baseUrl = '/Job';

  async getJobList(
    request: JobListRequestVM = {}
  ): Promise<PagedResponse<JobListItem>> {
    console.log('[JobService] Getting job list:', request);
    return this.handleRequest(
      () => this.getAll<JobListItem>(request),
      'Failed to fetch job list'
    );
  }

  async getJobById(id: string): Promise<JobRM> {
    return this.handleRequest(
      () => this.getById<JobRM>(id),
      'Failed to fetch job'
    );
  }

  async getMyAssignedJobById(id: string): Promise<JobRM> {
    return this.handleRequest(
      async () => {
        const response = await api.get<JobRM>(`/JobAssignment/my-job/${id}`);
        return response;
      },
      'Failed to fetch assigned job'
    );
  }

  async createJob(data: CreateJobVM): Promise<JobRM> {
    console.log('[JobService] Creating job:', data);
    return this.handleRequest(
      async () => {
        const result = await this.create<CreateJobVM, JobRM>(data);
        console.log('[JobService] Job created response:', result);
        console.log('[JobService] Job number from response:', result?.jobNumber);
        return result;
      },
      'Failed to create job'
    );
  }

  async updateJob(data: UpdateJobVM): Promise<JobRM> {
    if (!data.id) {
      throw new Error('Job ID is required for update');
    }
    return this.handleRequest(
      () => this.update<UpdateJobVM, JobRM>(data as UpdateJobVM & { id: string }),
      'Failed to update job'
    );
  }

  async deleteJob(id: string): Promise<void> {
    return this.handleRequest(
      () => this.delete(id),
      'Failed to delete job'
    );
  }

  // Status management
  async updateJobStatus(jobId: string, status: JobStatus): Promise<JobRM> {
    return this.handleRequest(
      () => this.updateJob({
        id: jobId,
        status,
      }),
      'Failed to update job status'
    );
  }

  async startJob(jobId: string): Promise<JobRM> {
    return this.handleRequest(
      async () => {
        // TODO: Implement dedicated start endpoint if available
        return await this.updateJobStatus(jobId, JobService.STATUS.IN_PROGRESS);
      },
      'Failed to start job'
    );
  }

  async completeJob(jobId: string): Promise<JobRM> {
    return this.handleRequest(
      async () => {
        // TODO: Implement dedicated complete endpoint if available
        return await this.updateJobStatus(jobId, JobService.STATUS.COMPLETED);
      },
      'Failed to complete job'
    );
  }

  async pauseJob(jobId: string, reason?: string): Promise<JobRM> {
    return this.handleRequest(
      async () => {
        // TODO: Implement pause with reason endpoint
        return await this.updateJobStatus(jobId, JobService.STATUS.ON_HOLD);
      },
      'Failed to pause job'
    );
  }

  async cancelJob(jobId: string, reason?: string): Promise<JobRM> {
    return this.handleRequest(
      async () => {
        // TODO: Implement cancel with reason endpoint
        return await this.updateJobStatus(jobId, JobService.STATUS.CANCELLED);
      },
      'Failed to cancel job'
    );
  }

  // Media operations
  async addMedia(data: CreateJobMediaVM): Promise<JobMediaRM> {
    return this.handleRequest(
      () => api.post<JobMediaRM>('/JobMedia/create', data),
      'Failed to add media to job'
    );
  }

  async updateMedia(data: UpdateJobMediaVM): Promise<JobMediaRM> {
    return this.handleRequest(
      () => api.put<JobMediaRM>('/JobMedia/update', data),
      'Failed to update job media'
    );
  }

  async removeMedia(mediaId: string): Promise<void> {
    return this.handleRequest(
      () => api.delete(`/JobMedia/${mediaId}`),
      'Failed to remove media from job'
    );
  }

  // Inventory management for jobs
  async addInventoryToJob(
    jobId: string,
    inventoryItems: CreateJobInventoryVM[]
  ): Promise<JobRM> {
    return this.handleRequest(
      async () => {
        // TODO: Implement dedicated inventory assignment endpoint
        const job = await this.getJobById(jobId);

        // This would need to be implemented in the backend
        // return await api.post(`${this.baseUrl}/${jobId}/inventory`, {
        //   items: inventoryItems,
        // });

        throw new Error('Inventory assignment not implemented');
      },
      'Failed to add inventory to job'
    );
  }

  async updateJobInventory(
    jobId: string,
    inventoryId: string,
    actualQuantity: number
  ): Promise<JobRM> {
    return this.handleRequest(
      async () => {
        // TODO: Implement inventory update endpoint
        throw new Error('Inventory update not implemented');
      },
      'Failed to update job inventory'
    );
  }

  async removeInventoryFromJob(
    jobId: string,
    inventoryId: string
  ): Promise<JobRM> {
    return this.handleRequest(
      async () => {
        // TODO: Implement inventory removal endpoint
        throw new Error('Inventory removal not implemented');
      },
      'Failed to remove inventory from job'
    );
  }

  // Search and filter methods
  async getJobsByStatus(status: JobStatus): Promise<JobListItem[]> {
    return this.handleRequest(
      async () => {
        const response = await this.getJobList({
          status,
          pageSize: 100,
        });
        return response.items;
      },
      'Failed to fetch jobs by status'
    );
  }

  async getJobsByClient(clientId: string): Promise<JobListItem[]> {
    return this.handleRequest(
      async () => {
        const response = await this.getJobList({
          clientId,
          pageSize: 100,
        });
        return response.items;
      },
      'Failed to fetch jobs by client'
    );
  }

  async getActiveJobs(): Promise<JobListItem[]> {
    return this.handleRequest(
      async () => {
        const response = await this.getJobList({
          pageSize: 100,
        });
        return response.items.filter(job =>
          job.status === JobService.STATUS.SCHEDULED ||
          job.status === JobService.STATUS.IN_PROGRESS
        );
      },
      'Failed to fetch active jobs'
    );
  }

  async getOverdueJobs(): Promise<JobListItem[]> {
    return this.handleRequest(
      async () => {
        // TODO: Implement date filtering when dates are added to JobRM
        const response = await this.getJobList({
          status: JobService.STATUS.SCHEDULED,
          pageSize: 100,
        });
        return response.items;
      },
      'Failed to fetch overdue jobs'
    );
  }

  async searchJobs(query: string): Promise<JobListItem[]> {
    return this.handleRequest(
      async () => {
        const response = await this.getJobList({
          searchTerm: query,
          pageSize: 50,
        });
        return response.items;
      },
      'Failed to search jobs'
    );
  }

  // Analytics and reporting
  async getJobStats(dateRange?: {
    startDate: string;
    endDate: string;
  }): Promise<{
    totalJobs: number;
    completedJobs: number;
    inProgressJobs: number;
    scheduledJobs: number;
    cancelledJobs: number;
    completionRate: number;
  }> {
    return this.handleRequest(
      async () => {
        const response = await this.getJobList({
          pageSize: 1000,
        });

        const jobs = response.items;
        const totalJobs = jobs.length;
        const completedJobs = jobs.filter(j => j.status === JobService.STATUS.COMPLETED).length;
        const inProgressJobs = jobs.filter(j => j.status === JobService.STATUS.IN_PROGRESS).length;
        const scheduledJobs = jobs.filter(j => j.status === JobService.STATUS.SCHEDULED).length;
        const cancelledJobs = jobs.filter(j => j.status === JobService.STATUS.CANCELLED).length;
        const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

        return {
          totalJobs,
          completedJobs,
          inProgressJobs,
          scheduledJobs,
          cancelledJobs,
          completionRate,
        };
      },
      'Failed to fetch job statistics'
    );
  }

  // Recurring job methods
  async setRecurrence(
    jobId: string,
    data: { recurrenceRule?: string; recurrenceEndDate?: string; timeZone?: string }
  ): Promise<JobRM> {
    return this.handleRequest(
      () => api.put<JobRM>(`${this.baseUrl}/${jobId}/recurrence`, data),
      'Failed to set job recurrence'
    );
  }

  async getOccurrences(
    jobId: string,
    maxOccurrences: number = 52
  ): Promise<{ jobId: string; isRecurring: boolean; recurrenceRule: string; timeZone: string; occurrences: string[] }> {
    return this.handleRequest(
      () => api.get(`${this.baseUrl}/${jobId}/occurrences`, { params: { maxOccurrences } }),
      'Failed to get job occurrences'
    );
  }

  // Recurring job - get child jobs
  async getChildJobs(
    parentJobId: string
  ): Promise<{ parentJobId: string; parentJobTitle: string; isRecurring: boolean; childJobs: JobListItem[] }> {
    return this.handleRequest(
      () => api.get(`${this.baseUrl}/${parentJobId}/children`),
      'Failed to get child jobs'
    );
  }

  // Skip a visit (child job)
  async skipVisit(jobId: string): Promise<JobRM> {
    return this.handleRequest(
      () => api.put<JobRM>(`${this.baseUrl}/${jobId}/skip`, {}),
      'Failed to skip visit'
    );
  }

  // Unskip a visit (child job)
  async unskipVisit(jobId: string): Promise<JobRM> {
    return this.handleRequest(
      () => api.put<JobRM>(`${this.baseUrl}/${jobId}/unskip`, {}),
      'Failed to unskip visit'
    );
  }

  // Job status constants
  static readonly STATUS = {
    DRAFT: 'draft',
    SCHEDULED: 'scheduled',
    IN_PROGRESS: 'in_progress',
    ON_HOLD: 'on_hold',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    SKIPPED: 'skipped',
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
      skipped: 'Skipped',
    };
    return statusMap[status] || status;
  }

  // Find a job linked to an estimate or any of its version siblings
  async getJobByEstimateId(estimateId: string): Promise<{ found: boolean; job?: JobRM }> {
    return this.handleRequest(
      async () => {
        const response = await api.get<{ found: boolean; job?: JobRM }>(
          `${this.baseUrl}/by-estimate/${estimateId}`
        );
        return response;
      },
      'Failed to find job by estimate'
    );
  }

  // Helper method to get status color
  static getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      draft: '#6B7280',
      scheduled: '#3B82F6',
      in_progress: '#10B981',
      on_hold: '#F59E0B',
      completed: '#059669',
      cancelled: '#EF4444',
      skipped: '#9CA3AF',
    };
    return colorMap[status] || '#6B7280';
  }
}

// Export status type for external use
export type JobStatus = typeof JobService.STATUS[keyof typeof JobService.STATUS];

// Create singleton instance
export const jobService = new JobService();
