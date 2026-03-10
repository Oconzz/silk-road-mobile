import { apiClient } from '../../core/httpClient';
import type { PagedResponse } from '../../../../types/apiResponses';
import type { 
  TimeCard, 
  TimeCardListItem, 
  TimeCardSummary, 
  ActiveTimeCard, 
  ClockInRequest, 
  ClockOutRequest, 
  TimeCardListRequest,
  UpdateTimeCardRequest,
  ApproveTimeCardRequest,
  BulkApproveTimeCardsRequest,
  TimeCardsByJobReport,
  TimeCardsByUserReport,
  PayrollReport
} from '../../../../types/timeCard';

class TimeCardService {
  async getTimeCards(request: TimeCardListRequest = {}): Promise<PagedResponse<TimeCardListItem>> {
    const payload = {
      userId: request.userId,
      jobId: request.jobId,
      startDate: request.startDate,
      endDate: request.endDate,
      status: request.status,
      viewTeam: request.viewTeam ?? false,
      pageNumber: request.pageNumber || 1,
      pageSize: request.pageSize || 100,
    };
    console.log('[TimeCardService] getTimeCards request:', JSON.stringify(payload));
    const response = await apiClient.post<PagedResponse<TimeCardListItem>>(
      '/TimeCard/list',
      payload
    );
    console.log('[TimeCardService] getTimeCards response items:', response.data?.items?.length ?? 0);
    return response.data;
  }

  async getActiveTimeCard(): Promise<ActiveTimeCard | null> {
    const response = await apiClient.get<ActiveTimeCard>('/TimeCard/active');
    return response.data;
  }

  async clockIn(request: ClockInRequest): Promise<TimeCard> {
    const response = await apiClient.post<TimeCard>('/TimeCard/clock-in', request);
    return response.data;
  }

  async clockOut(request: ClockOutRequest): Promise<TimeCard> {
    const response = await apiClient.post<TimeCard>('/TimeCard/clock-out', request);
    return response.data;
  }

  async getWeeklySummary(): Promise<TimeCardSummary> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const response = await apiClient.get<TimeCardSummary>(
      `/TimeCard/summary?startDate=${startOfWeek.toISOString()}&endDate=${now.toISOString()}`
    );
    return response.data;
  }

  async getTimeCardById(id: string): Promise<TimeCard> {
    const response = await apiClient.get<TimeCard>(`/TimeCard/${id}`);
    return response.data;
  }

  async updateTimeCard(request: UpdateTimeCardRequest): Promise<TimeCard> {
    const response = await apiClient.put<TimeCard>('/TimeCard/update', request);
    return response.data;
  }

  async deleteTimeCard(id: string): Promise<void> {
    await apiClient.delete(`/TimeCard/${id}`);
  }

  async approveTimeCard(request: ApproveTimeCardRequest): Promise<TimeCard> {
    const response = await apiClient.post<TimeCard>('/TimeCard/approve', request);
    return response.data;
  }

  async bulkApproveTimeCards(request: BulkApproveTimeCardsRequest): Promise<TimeCard[]> {
    const response = await apiClient.post<TimeCard[]>('/TimeCard/approve-bulk', request);
    return response.data;
  }

  async getTimeCardsByJobReport(startDate: string, endDate: string): Promise<TimeCardsByJobReport[]> {
    const response = await apiClient.get<TimeCardsByJobReport[]>(
      `/TimeCard/reports/by-job?startDate=${startDate}&endDate=${endDate}`
    );
    return response.data;
  }

  async getTimeCardsByUserReport(startDate: string, endDate: string): Promise<TimeCardsByUserReport[]> {
    const response = await apiClient.get<TimeCardsByUserReport[]>(
      `/TimeCard/reports/by-user?startDate=${startDate}&endDate=${endDate}`
    );
    return response.data;
  }

  async getPayrollReport(startDate: string, endDate: string): Promise<PayrollReport> {
    const response = await apiClient.get<PayrollReport>(
      `/TimeCard/reports/payroll?startDate=${startDate}&endDate=${endDate}`
    );
    return response.data;
  }
}

export const timeCardService = new TimeCardService();
