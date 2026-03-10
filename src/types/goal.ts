export type GoalStatus = 'pending' | 'completed' | 'overdue';

export interface GoalVote {
  id: string;
  goalId: string;
  userId: string;
  userName: string;
  voteComplete: boolean;
  voteDate: string;
}

export interface Goal {
  id: string;
  jobId: string;
  companyId: string;
  title: string;
  description?: string;
  completionBonus?: string;
  bonusAmount?: number;
  deadline: string;
  isOverdue: boolean;
  daysUntilDeadline: number;
  
  // Assignment
  assignedToUserId?: string;
  assignedToUserName?: string;
  assignedToUserPhoto?: string;
  isTeamGoal: boolean;
  
  // Voting (for team goals)
  votes?: GoalVote[];
  totalVotesNeeded?: number;
  votesReceived?: number;
  
  // Creator
  createdByUserId: string;
  createdByUserName?: string;
  
  // Status
  status: GoalStatus;
  completedAt?: string;
  completedOnTime?: boolean;
  completedByUserId?: string;
  completedByUserName?: string;
  
  sortOrder: number;
  createDatetime: string;
  updateDatetime: string;
}

export interface CreateGoalRequest {
  jobId: string;
  title: string;
  description?: string;
  deadline: string;
  assignedToUserId?: string;
  bonusAmount?: number;
  requiresVerification?: boolean;
  sortOrder?: number;
}

export interface UpdateGoalRequest {
  title?: string;
  description?: string;
  deadline?: string;
  assignedToUserId?: string;
  sortOrder?: number;
}

export interface JobGoalsSummary {
  jobId: string;
  totalGoals: number;
  completedGoals: number;
  pendingGoals: number;
  overdueGoals: number;
  completedOnTime: number;
  completedLate: number;
  completionRate: number;
  onTimeRate: number;
}

export interface UserGoalsSummary {
  userId: string;
  totalAssigned: number;
  completed: number;
  pending: number;
  overdue: number;
  completedOnTime: number;
  completedLate: number;
  completionRate: number;
  onTimeRate: number;
  upcomingGoals: Goal[];
  overdueGoals: Goal[];
}

export interface GoalContextType {
  // State
  goals: Goal[];
  currentGoal: Goal | null;
  jobGoals: Goal[];
  myGoals: Goal[];
  jobGoalsSummary: JobGoalsSummary | null;
  userGoalsSummary: UserGoalsSummary | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createGoal: (data: CreateGoalRequest) => Promise<Goal>;
  updateGoal: (goalId: string, data: UpdateGoalRequest) => Promise<Goal>;
  deleteGoal: (goalId: string) => Promise<void>;
  completeGoal: (goalId: string) => Promise<Goal>;
  voteGoalComplete: (goalId: string) => Promise<Goal>;
  forceCompleteGoal: (goalId: string) => Promise<Goal>;
  reopenGoal: (goalId: string) => Promise<Goal>;
  
  // Fetching
  loadGoal: (goalId: string) => Promise<void>;
  loadJobGoals: (jobId: string, status?: string) => Promise<void>;
  loadMyGoals: (status?: string) => Promise<void>;
  loadJobGoalsSummary: (jobId: string) => Promise<void>;
  loadUserGoalsSummary: () => Promise<void>;
  
  // Bulk
  bulkCreateGoals: (jobId: string, goals: CreateGoalRequest[]) => Promise<Goal[]>;
  
  // Clear
  clearError: () => void;
}
