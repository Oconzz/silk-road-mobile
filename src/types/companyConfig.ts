export interface CompanyConfig {
  id: string;
  companyId: string;
  defaultTermsAndConditions?: string;
  lunchDeductionMinutes: number;
  workDayStartHour: number;
  workDayStartMinute: number;
  workDayEndHour: number;
  workDayEndMinute: number;
  workDays: string;
  enableClockInReminder: boolean;
  enableClockOutReminder: boolean;
  reminderMinutesBefore: number;
  requireApproval: boolean;
  overtimeThresholdHours: number;
  weeklyOvertimeThresholdHours: number;
  createDatetime: string;
  updateDatetime: string;
}

export interface UpdateCompanyConfigRequest {
  defaultTermsAndConditions?: string;
  lunchDeductionMinutes?: number;
  workDayStartHour?: number;
  workDayStartMinute?: number;
  workDayEndHour?: number;
  workDayEndMinute?: number;
  workDays?: string;
  enableClockInReminder?: boolean;
  enableClockOutReminder?: boolean;
  reminderMinutesBefore?: number;
  requireApproval?: boolean;
  overtimeThresholdHours?: number;
  weeklyOvertimeThresholdHours?: number;
}

export interface CreateCompanyConfigRequest {
  defaultTermsAndConditions?: string;
  lunchDeductionMinutes: number;
  workDayStartHour: number;
  workDayStartMinute: number;
  workDayEndHour: number;
  workDayEndMinute: number;
  workDays: string;
  enableClockInReminder: boolean;
  enableClockOutReminder: boolean;
  reminderMinutesBefore: number;
  requireApproval: boolean;
  overtimeThresholdHours: number;
  weeklyOvertimeThresholdHours: number;
}

export const WEEKDAYS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

export const formatWorkDays = (workDays: string): string => {
  const days = workDays.split(',').map(d => parseInt(d.trim(), 10));
  return days.map(d => WEEKDAYS[d]?.label.substring(0, 3)).join(', ');
};

export const formatTime = (hour: number, minute: number): string => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  const displayMinute = minute.toString().padStart(2, '0');
  return `${displayHour}:${displayMinute} ${period}`;
};
