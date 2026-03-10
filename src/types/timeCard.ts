export interface TimeCard {
  id: string;
  userId: string;
  userName: string;
  companyId: string;
  jobId?: string;
  jobName?: string;
  clockInTime: string;
  clockOutTime?: string;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  breakMinutes: number;
  billableHours: number;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedByUserId?: string;
  approvedByUserName?: string;
  approvedDatetime?: string;
  rejectionReason?: string;
  isAutoClockIn: boolean;
  isAutoClockOut: boolean;
  clockInLatitude?: number;
  clockInLongitude?: number;
  clockOutLatitude?: number;
  clockOutLongitude?: number;
  createDatetime: string;
  updateDatetime: string;
}

export interface TimeCardListItem {
  id: string;
  userId: string;
  userName: string;
  jobId?: string;
  jobName?: string;
  clockInTime: string;
  clockOutTime?: string;
  totalHours: number;
  overtimeHours: number;
  billableHours: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface TimeCardSummary {
  userId: string;
  userName: string;
  startDate: string;
  endDate: string;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalHours: number;
  totalDays: number;
}

export interface ActiveTimeCard {
  id: string;
  jobId?: string;
  jobName?: string;
  clockInTime: string;
  elapsedHours: number;
}

export interface ClockInRequest {
  jobId?: string;
  jobName?: string;
  latitude?: number;
  longitude?: number;
  isAutoClockIn?: boolean;
}

export interface ClockOutRequest {
  timeCardId: string;
  latitude?: number;
  longitude?: number;
  isAutoClockOut?: boolean;
  notes?: string;
}

export interface TimeCardListRequest {
  userId?: string;
  jobId?: string;
  startDate?: string;
  endDate?: string;
  status?: 'all' | 'pending' | 'approved' | 'rejected';
  viewTeam?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

export type TimeCardStatus = 'clocked_in' | 'clocked_out';

export interface UpdateTimeCardRequest {
  id: string;
  clockInTime?: string;
  clockOutTime?: string;
  breakMinutes?: number;
  notes?: string;
}

export interface ApproveTimeCardRequest {
  timeCardId: string;
  approved: boolean;
  rejectionReason?: string;
}

export interface BulkApproveTimeCardsRequest {
  timeCardIds: string[];
  approved: boolean;
  rejectionReason?: string;
}

export interface TimeCardsByJobReport {
  jobId: string;
  jobName: string;
  totalHours: number;
  totalBillableHours: number;
  totalCost: number;
  timeCardCount: number;
}

export interface TimeCardsByUserReport {
  userId: string;
  userName: string;
  totalHours: number;
  totalBillableHours: number;
  totalOvertimeHours: number;
  daysWorked: number;
}

export interface PayrollItem {
  userId: string;
  userName: string;
  userEmail: string;
  regularHours: number;
  overtimeHours: number;
  totalBillableHours: number;
  daysWorked: number;
  timeCardIds: string[];
}

export interface PayrollReport {
  startDate: string;
  endDate: string;
  items: PayrollItem[];
}

export const formatDuration = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export const formatTimeCardDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export const formatTimeCardTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};
