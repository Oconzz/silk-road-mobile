// Push notification types

export type NotificationTopic =
  | 'material_return'      // Material Return Date (3-day warning)
  | 'timecard_reminder'    // Time Card Reminders (clock-in/clock-out)
  | 'job_assignment'       // Job Assignments (immediate)
  | 'reward_goal'          // In-App Rewards/Goals (day of + 2h before)
  | 'review_prompt'        // In-App Review Prompt (3 jobs or 1 month)
  | 'general';             // General announcements

export interface PushNotificationPayload {
  topic: NotificationTopic;
  title: string;
  body: string;
  data?: Record<string, string>;
}

// Navigation targets for notification deep links
export interface NotificationNavTarget {
  screen: string;
  params?: Record<string, any>;
}

// Map topics to navigation targets
export const NOTIFICATION_NAV_MAP: Record<NotificationTopic, (data?: Record<string, string>) => NotificationNavTarget> = {
  material_return: (data) => ({
    screen: 'JobDetail',
    params: { jobId: data?.jobId },
  }),
  timecard_reminder: () => ({
    screen: 'TeamMembers',
  }),
  job_assignment: (data) => ({
    screen: 'JobDetail',
    params: { jobId: data?.jobId },
  }),
  reward_goal: () => ({
    screen: 'Home',
  }),
  review_prompt: () => ({
    screen: 'Home',
  }),
  general: () => ({
    screen: 'Home',
  }),
};

// Device token registration payload (sent to backend)
export interface DeviceTokenPayload {
  token: string;
  platform: 'ios' | 'android';
  deviceId?: string;
}

// Notification preferences (stored locally + synced to backend)
export interface NotificationPreferences {
  enabled: boolean;
  materialReturn: boolean;
  timecardReminder: boolean;
  jobAssignment: boolean;
  rewardGoal: boolean;
  reviewPrompt: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  materialReturn: true,
  timecardReminder: true,
  jobAssignment: true,
  rewardGoal: true,
  reviewPrompt: true,
};
