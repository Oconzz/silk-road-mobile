// Job Types - Core feature that connects everything

import type {
  ClientListItem,
  Location,
  EstimateLineItem,
  EstimateMedia,
  EstimateAlbum,
} from './estimate';
import type { JobRM, JobListItem } from './apiResponses';
import type { CreateJobVM, UpdateJobVM } from './apiRequests';

// ===== Recurrence Types =====
export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};

export const WEEKDAY_OPTIONS = [
  { label: 'Sun', value: 'SU' },
  { label: 'Mon', value: 'MO' },
  { label: 'Tue', value: 'TU' },
  { label: 'Wed', value: 'WE' },
  { label: 'Thu', value: 'TH' },
  { label: 'Fri', value: 'FR' },
  { label: 'Sat', value: 'SA' },
];

export const NTH_POSITION_LABELS: Record<number, string> = {
  1: '1st',
  2: '2nd',
  3: '3rd',
  4: '4th',
  [-1]: 'Last',
};

const WEEKDAY_MAP: Record<string, string> = {
  SU: 'Sunday', MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday',
  TH: 'Thursday', FR: 'Friday', SA: 'Saturday',
};

export const parseRRuleToHuman = (rrule: string): { summary: string; detail: string } => {
  const parts: Record<string, string> = {};
  rrule.split(';').forEach(part => {
    const [k, v] = part.split('=');
    if (k && v) { parts[k] = v; }
  });

  const freq = parts.FREQ || 'WEEKLY';
  const interval = parseInt(parts.INTERVAL || '1', 10);
  const byDay = parts.BYDAY ? parts.BYDAY.split(',') : [];

  let freqLabel = '';
  switch (freq) {
    case 'DAILY':   freqLabel = interval === 1 ? 'Every day'    : `Every ${interval} days`;   break;
    case 'WEEKLY':  freqLabel = interval === 1 ? 'Every week'   : `Every ${interval} weeks`;  break;
    case 'MONTHLY': freqLabel = interval === 1 ? 'Every month'  : `Every ${interval} months`; break;
    case 'YEARLY':  freqLabel = interval === 1 ? 'Every year'   : `Every ${interval} years`;  break;
    default:        freqLabel = 'Recurring'; break;
  }

  let dayLabel = '';
  if (byDay.length > 0) {
    // Check for Nth weekday pattern (e.g. 1FR, -1MO)
    const nthMatch = byDay[0]?.match(/^(-?\d)(\w{2})$/);
    if (nthMatch && freq === 'MONTHLY') {
      const pos = parseInt(nthMatch[1], 10);
      const day = nthMatch[2];
      const posLabel = NTH_POSITION_LABELS[pos] || `${pos}th`;
      const dayName = WEEKDAY_MAP[day] || day;
      dayLabel = `${posLabel} ${dayName}`;
    } else {
      const dayNames = byDay.map(d => WEEKDAY_MAP[d] || d);
      if (dayNames.length === 1) {
        dayLabel = dayNames[0];
      } else if (dayNames.length === 2) {
        dayLabel = `${dayNames[0]} & ${dayNames[1]}`;
      } else {
        dayLabel = dayNames.slice(0, -1).join(', ') + ' & ' + dayNames[dayNames.length - 1];
      }
    }
  }

  const summary = dayLabel ? `${freqLabel} on ${dayLabel}` : freqLabel;

  let detail = '';
  if (parts.UNTIL) {
    try {
      const until = new Date(parts.UNTIL.replace(/(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3'));
      detail = `Until ${until.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } catch { detail = ''; }
  } else if (parts.COUNT) {
    detail = `${parts.COUNT} times`;
  } else {
    detail = 'No end date';
  }

  return { summary, detail };
};

export type RecurrenceEndType = 'never' | 'on_date' | 'after_count';

export interface RecurrenceConfig {
  frequency: RecurrenceFrequency;
  interval: number;
  byDay?: string[]; // e.g. ['MO','WE','FR']
  endType?: RecurrenceEndType;
  endDate?: string;
  count?: number;
  // Monthly Nth weekday: e.g. nthWeekday = { position: 1, day: 'FR' } => 1st Friday
  nthWeekday?: { position: number; day: string } | null;
  // As Needed mode: recurrence template without auto-scheduling
  asNeeded?: boolean;
}

export interface JobOccurrencesResponse {
  jobId: string;
  isRecurring: boolean;
  recurrenceRule: string;
  timeZone: string;
  occurrences: string[];
}

export type BillingFrequency = 'per_visit' | 'monthly' | 'on_completion' | 'custom';

export const BILLING_FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  per_visit: 'Per Visit',
  monthly: 'Monthly',
  on_completion: 'On Completion',
  custom: 'Custom',
};

export interface SetRecurrenceRequest {
  recurrenceRule?: string;
  recurrenceEndDate?: string;
  timeZone?: string;
}

// ===== Job Status =====
export type JobStatus =
  | 'draft'
  | 'scheduled'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'cancelled'
  | 'skipped'
  | string; // Allow any string for backend compatibility

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
  skipped: 'Skipped',
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  draft: '#6B7280',      // gray
  scheduled: '#3B82F6',  // blue
  in_progress: '#F59E0B', // amber
  on_hold: '#EF4444',    // red
  completed: '#10B981',  // green
  cancelled: '#9CA3AF',  // gray light
  skipped: '#D1D5DB',   // gray lighter
};

// ===== Inventory Allocation =====
export type AllocationStatus = 'reserved' | 'loaded' | 'used' | 'returned' | 'partial_return';

export interface InventoryAllocation {
  id: string;
  jobId: string;
  inventoryId?: string;
  productId?: string;
  warehouseId?: string;
  inventoryTitle?: string;
  title?: string;
  inventoryBarcode?: string;
  requestedQty?: number;
  reservedQty?: number;
  idealQuantity?: number;
  actualQuantity?: number;
  usedQty?: number;
  returnedQty?: number;
  unitCost?: number;
  price?: number;
  status?: AllocationStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ===== Job Milestone =====
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface JobMilestone {
  id: string;
  jobId: string;
  title: string;
  description?: string;
  sortOrder: number;
  dueDate?: string;
  completedDate?: string;
  status: MilestoneStatus;
  mediaIds?: string[]; // Photos for verification
  notes?: string;
}

// ===== Job Note =====
export interface JobNote {
  id: string;
  jobId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string; // userId
}

// ===== Job Line Item (inherited from Estimate) =====
export interface JobLineItem extends EstimateLineItem {
  allocatedQty?: number;
  usedQty?: number;
  returnedQty?: number;
}

// ===== Main Job Interface =====
export interface Job {
  id: string;
  companyId: string;
  jobNumber: string; // JOB-000123
  title: string;
  description: string;
  status: JobStatus;

  // Relationships
  client?: ClientListItem;
  location?: Location;
  estimateId?: string; // Source estimate
  estimateNumber?: string;
  estimateTitle?: string;
  
  // Scheduling
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;

  // Financial
  estimatedTotal: number;
  actualTotal: number;
  laborCost: number;
  materialsCost: number;
  profit: number; // actualTotal - (laborCost + materialsCost)

  // Line Items (from Estimate)
  lineItems: JobLineItem[];

  // Inventory Tracking
  inventoryAllocations: InventoryAllocation[];

  // Progress
  milestones: JobMilestone[];
  completionPercentage: number; // 0-100

  // Media (like Estimate)
  media?: EstimateMedia[];
  albums?: EstimateAlbum[];

  // Notes
  notes: JobNote[];

  // Team
  assignedUserIds?: string[];

  // Recurring Job fields
  isRecurring?: boolean;
  recurrenceRule?: string;
  recurrenceEndDate?: string;
  timeZone?: string;

  // Google Calendar Integration (NMJ-40, NMJ-41)
  googleCalendarEventId?: string;

  // Timestamps
  createDatetime: string;
  updateDatetime: string;
}

// Re-export JobListItem from apiResponses for backward compatibility
export type { JobListItem } from './apiResponses';

// ===== Request/Response Types =====
export interface CreateJobRequest {
  title: string;
  description: string;
  status?: JobStatus;
  clientId?: string;
  client?: ClientListItem;
  locationId?: string;
  estimateId?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  recurrenceEndDate?: string;
  timeZone?: string;
  inventoryAllocations?: Omit<InventoryAllocation, 'id' | 'jobId'>[];
  lineItems?: Omit<JobLineItem, 'id' | 'allocatedQty' | 'usedQty' | 'returnedQty'>[];
  media?: EstimateMedia[];
  albums?: EstimateAlbum[];
}

export interface UpdateJobRequest {
  id: string;
  title?: string;
  description?: string;
  status?: JobStatus;
  clientId?: string;
  locationId?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  recurrenceEndDate?: string;
  timeZone?: string;
}

export interface JobListRequest {
  pageNumber?: number;
  pageSize?: number;
  searchTerm?: string;
  status?: JobStatus;
  clientId?: string;
}

export interface ConvertEstimateToJobRequest {
  estimateId: string;
  jobTitle?: string;
  jobDescription?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
}

// ===== Client Profile (Extended) =====
export interface ClientNote {
  id: string;
  clientId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientProfile {
  id: string;
  companyId: string;
  contactName: string;
  phone: string;
  email: string;
  companyName?: string;
  location?: Location;
  createDatetime: string;
  updateDatetime: string;

  // Extended fields
  estimates: import('./estimate').EstimateListItem[];
  jobs: JobListItem[];
  totalSpent: number;
  totalJobs: number;
  completedJobs: number;
  lastJobDate?: string;
  notes: ClientNote[];

  // Statistics
  averageJobValue: number;
  totalEstimates: number;
  approvalRate: number; // % of estimates that became jobs
}

// ===== Job Context Type =====
export interface JobContextType {
  // Jobs
  jobs: JobListItem[];
  currentJob: JobRM | null;
  loading: boolean;
  isLoading: boolean; // Alias for loading
  error: string | null;

  // Actions - Jobs
  loadJobs: (forceRefresh?: boolean) => Promise<void>;
  loadJob: (id: string) => Promise<void>;
  createJob: (data: CreateJobVM) => Promise<JobRM>;
  updateJob: (id: string, data: UpdateJobVM) => Promise<JobRM>;
  deleteJob: (id: string) => Promise<void>;
  initDraftForEdit: (job: JobRM) => void;

  // Status management
  startJob: (jobId: string) => Promise<void>;
  completeJob: (jobId: string) => Promise<void>;
  pauseJob: (jobId: string, reason?: string) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;

  // Estimate conversion
  convertEstimateToJob: (estimateId: string, data?: any) => Promise<any>;
  syncJobWithEstimate: (jobId: string, estimateId: string) => Promise<void>;
  updateJobStatus: (jobId: string, status: JobStatus) => Promise<void>;

  // Milestones
  completeMilestone: (jobId: string, milestoneId: string) => Promise<void>;
  updateMilestone: (jobId: string, milestoneId: string, data: Partial<JobMilestone>) => Promise<void>;

  // Notes
  addJobNote: (jobId: string, note: { content: string; type?: string }) => Promise<any>;

  // Inventory
  markInventoryUsed: (jobId: string, inventoryId: string, quantity: number) => Promise<void>;
  markInventoryReturned: (jobId: string, inventoryId: string, quantity: number) => Promise<void>;

  // Search & filtering
  searchJobs: (query: string) => Promise<JobListItem[]>;
  getJobsByClient: (clientId: string) => Promise<JobListItem[]>;
  getJobsByStatus: (status: JobStatus) => Promise<JobListItem[]>;

  // Client profile
  clientProfile: any | null;
  clientProfileLoading: boolean;
  loadClientProfile: (clientId: string) => Promise<void>;
  addClientNote: (clientId: string, note: any) => Promise<void>;
  removeClientNote: (clientId: string, noteId: string) => Promise<void>;

  // Media
  addMedia: (media: any) => Promise<void>;
  removeMedia: (mediaId: string) => Promise<void>;

  // Recurring
  setRecurrence: (jobId: string, data: SetRecurrenceRequest) => Promise<void>;
  getOccurrences: (jobId: string, maxOccurrences?: number) => Promise<JobOccurrencesResponse | null>;
  getChildJobs: (parentJobId: string) => Promise<JobListItem[]>;
  skipVisit: (jobId: string) => Promise<void>;
  unskipVisit: (jobId: string) => Promise<void>;

  // Clear error
  clearError: () => void;
}

// ===== Helper Functions =====
export const generateJobNumber = (): string => {
  const timestamp = Date.now().toString().slice(-6);
  return `JOB-${timestamp}`;
};

export const getJobStatusColor = (status: JobStatus): string => {
  return JOB_STATUS_COLORS[status] || '#6B7280';
};

export const getJobStatusLabel = (status: JobStatus): string => {
  return JOB_STATUS_LABELS[status] || status;
};

export const calculateJobProgress = (milestones: JobMilestone[]): number => {
  if (milestones.length === 0) return 0;
  const completed = milestones.filter(m => m.status === 'completed').length;
  return Math.round((completed / milestones.length) * 100);
};

export const calculateJobProfit = (
  actualTotal: number,
  laborCost: number,
  materialsCost: number
): number => {
  return actualTotal - (laborCost + materialsCost);
};

// Default milestones for new jobs
export const DEFAULT_MILESTONES: Omit<JobMilestone, 'id' | 'jobId'>[] = [
  {
    title: 'Job Started',
    description: 'Work has begun on site',
    sortOrder: 1,
    status: 'pending',
  },
  {
    title: 'Materials Delivered',
    description: 'All materials have been delivered to site',
    sortOrder: 2,
    status: 'pending',
  },
  {
    title: 'Work in Progress',
    description: 'Main work is being executed',
    sortOrder: 3,
    status: 'pending',
  },
  {
    title: 'Quality Check',
    description: 'Final inspection and quality verification',
    sortOrder: 4,
    status: 'pending',
  },
  {
    title: 'Job Completed',
    description: 'All work has been completed and approved',
    sortOrder: 5,
    status: 'pending',
  },
];
