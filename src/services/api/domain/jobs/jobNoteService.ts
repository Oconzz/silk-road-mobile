import { api } from '../../core/httpClient';
import type { PagedResponse } from '../../../../types/apiResponses';

export interface JobNoteRM {
  id: string;
  jobId: string;
  companyId: string;
  createdBy: string;
  createdByName: string;
  content: string;
  type: string;
  createDatetime: string;
  updateDatetime: string;
}

export interface JobNoteListItem {
  id: string;
  jobId: string;
  createdByName: string;
  content: string;
  type: string;
  createDatetime: string;
}

export interface CreateJobNoteVM {
  jobId: string;
  content: string;
  type?: string;
}

export interface UpdateJobNoteVM {
  id: string;
  content: string;
  type?: string;
}

export interface JobNoteListRequestVM {
  jobId: string;
  pageNumber?: number;
  pageSize?: number;
  type?: string;
}

class JobNoteService {
  async getJobNotes(request: JobNoteListRequestVM): Promise<PagedResponse<JobNoteListItem>> {
    return api.post<PagedResponse<JobNoteListItem>>('/JobNote/list', {
      jobId: request.jobId,
      pageNumber: request.pageNumber || 1,
      pageSize: request.pageSize || 50,
      type: request.type,
    });
  }

  async getJobNoteById(id: string): Promise<JobNoteRM> {
    return api.get<JobNoteRM>(`/JobNote/${id}`);
  }

  async createJobNote(request: CreateJobNoteVM): Promise<JobNoteRM> {
    return api.post<JobNoteRM>('/JobNote/create', {
      jobId: request.jobId,
      content: request.content,
      type: request.type || 'general',
    });
  }

  async updateJobNote(request: UpdateJobNoteVM): Promise<JobNoteRM> {
    return api.put<JobNoteRM>('/JobNote/update', {
      id: request.id,
      content: request.content,
      type: request.type || 'general',
    });
  }

  async deleteJobNote(id: string): Promise<{ message: string }> {
    return api.delete(`/JobNote/${id}`);
  }
}

export const jobNoteService = new JobNoteService();
