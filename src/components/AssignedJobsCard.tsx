import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useJob } from '../context/JobContext';
import { useTimeCard } from '../context/TimeCardContext';
import { useAuth } from '../context/AuthContext';
import { formatDuration } from '../types/timeCard';
import type { JobListItem } from '../types/apiResponses';

interface AssignedJobsCardProps {
  onJobPress: (jobId: string) => void;
  onViewAllJobs: () => void;
  onViewTimeCards: () => void;
}

export const AssignedJobsCard: React.FC<AssignedJobsCardProps> = ({
  onJobPress,
  onViewAllJobs,
  onViewTimeCards,
}) => {
  const {colors} = useTheme();
  const { jobs, loading: jobsLoading } = useJob();
  const { activeTimeCard, isClockedIn, loading: timeLoading, clockIn, clockOut, weeklySummary } = useTimeCard();
  const { currentCompany } = useAuth();
  const [elapsedTime, setElapsedTime] = useState(0);

  // Filter for in-progress jobs (assigned to contractor)
  const activeJobs = jobs.filter(job => job.status === 'in_progress' || job.status === 'scheduled');

  // Update elapsed time when clocked in
  useEffect(() => {
    if (!isClockedIn || !activeTimeCard) {
      setElapsedTime(0);
      return;
    }

    const updateElapsed = () => {
      const start = new Date(activeTimeCard.clockInTime).getTime();
      const now = Date.now();
      const hours = (now - start) / (1000 * 60 * 60);
      setElapsedTime(hours);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 60000);
    return () => clearInterval(interval);
  }, [isClockedIn, activeTimeCard]);

  const handleClockAction = async (job?: JobListItem) => {
    if (isClockedIn) {
      try {
        await clockOut();
      } catch (err) {
        console.error('Clock out error:', err);
      }
    } else if (job) {
      try {
        await clockIn({ jobId: job.id, jobName: job.title });
      } catch (err) {
        console.error('Clock in error:', err);
      }
    }
  };

  const isAdmin = currentCompany?.role === 'Admin' || currentCompany?.role === 'SuperAdmin';

  // Don't show for admins - they see inventory view
  if (isAdmin) {
    return null;
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.surface}]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="briefcase" size={20} color={colors.primary} />
          <Text style={[styles.title, {color: colors.text}]}>My Jobs</Text>
        </View>
        <TouchableOpacity onPress={onViewAllJobs} style={styles.viewAllBtn}>
          <Text style={[styles.viewAllText, {color: colors.text}]}>View All</Text>
          <Icon name="chevron-right" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Time Summary */}
      <View style={styles.timeSummary}>
        <View style={styles.timeItem}>
          <Text style={[styles.timeValue, {color: colors.text}]}>
            {weeklySummary ? formatDuration(weeklySummary.totalHours) : '0h'}
          </Text>
          <Text style={[styles.timeLabel, {color: colors.textSecondary}]}>This Week</Text>
        </View>
        <View style={[styles.timeDivider, {backgroundColor: colors.divider}]} />
        <View style={styles.timeItem}>
          <Text style={[styles.timeValue, {color: colors.text}]}>{weeklySummary?.totalDays || 0}</Text>
          <Text style={[styles.timeLabel, {color: colors.textSecondary}]}>Days</Text>
        </View>
        <TouchableOpacity onPress={onViewTimeCards} style={[styles.historyBtn, {backgroundColor: colors.surface}]}>
          <Icon name="clock" size={16} color={colors.accent} />
          <Text style={[styles.historyText, {color: colors.text}]}>History</Text>
        </TouchableOpacity>
      </View>

      {/* Clock Status */}
      {isClockedIn && activeTimeCard && (
        <View style={[styles.clockedInBanner, {backgroundColor: colors.successLight}]}>
          <View style={styles.clockedInInfo}>
            <View style={[styles.statusDot, {backgroundColor: colors.success}]} />
            <Text style={[styles.clockedInText, {color: colors.text}]}>Clocked In</Text>
            <Text style={[styles.elapsedText, {color: colors.text}]}>{formatDuration(elapsedTime)}</Text>
          </View>
          {activeTimeCard.jobName && (
            <Text style={[styles.jobNameText, {color: colors.text}]}>{activeTimeCard.jobName}</Text>
          )}
          <TouchableOpacity
            style={[styles.clockOutBtn, {backgroundColor: colors.error}]}
            onPress={() => handleClockAction()}
            disabled={timeLoading}
          >
            {timeLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="log-out" size={16} color="#fff" />
                <Text style={styles.clockOutText}>Clock Out</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Jobs List */}
      {jobsLoading ? (
        <View style={[styles.loadingContainer, {backgroundColor: colors.surface}]}>
          <ActivityIndicator size="small" color={colors.accent} />
        </View>
      ) : activeJobs.length === 0 ? (
        <View style={[styles.emptyContainer, {backgroundColor: colors.surface}]}>
          <Icon name="inbox" size={24} color={colors.textSecondary} />
          <Text style={[styles.emptyText, {color: colors.textSecondary}]}>No active jobs assigned</Text>
        </View>
      ) : (
        <View style={styles.jobsList}>
          {activeJobs.slice(0, 3).map((job) => (
            <TouchableOpacity               key={job.id}
              style={[styles.jobItem, {backgroundColor: colors.surface}]}
              onPress={() => onJobPress(job.id)}
            >
              <View style={styles.jobInfo}>
                <Text style={[styles.jobTitle, {color: colors.text}]} numberOfLines={1}>{job.title}</Text>
                <Text style={[styles.jobClient, {color: colors.text}]} numberOfLines={1}>
                  {job.clientName || 'No client'}
                </Text>
              </View>
              <View style={styles.jobActions}>
                {!isClockedIn && job.status === 'in_progress' && (
                  <TouchableOpacity
                    style={[styles.clockInBtn, {backgroundColor: colors.success}]}
                    onPress={() => handleClockAction(job)}
                    disabled={timeLoading}
                  >
                    <Icon name="log-in" size={14} color={colors.accent} />
                  </TouchableOpacity>
                )}
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: job.status === 'in_progress' ? colors.success + '20' : colors.warning + '20' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: job.status === 'in_progress' ? colors.success : colors.warning }
                  ]}>
                    {job.status === 'in_progress' ? 'Active' : 'Scheduled'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {

    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,

  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',

  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: theme.fontSize.sm,

    fontWeight: '500',
  },
  timeSummary: {
    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  timeItem: {
    flex: 1,
    alignItems: 'center',
  },
  timeValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',

  },
  timeLabel: {
    fontSize: theme.fontSize.xs,

    marginTop: 2,
  },
  timeDivider: {
    width: 1,
    height: 30,

    marginHorizontal: 12,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,

    borderRadius: 8,
  },
  historyText: {
    fontSize: theme.fontSize.sm,

    fontWeight: '500',
  },
  clockedInBanner: {

    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  clockedInInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,

  },
  clockedInText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',

  },
  elapsedText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',

    marginLeft: 'auto',
  },
  jobNameText: {
    fontSize: theme.fontSize.xs,

    marginBottom: 8,
  },
  clockOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,

    borderRadius: 8,
    paddingVertical: 8,
  },
  clockOutText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: theme.fontSize.sm,

  },
  jobsList: {
    gap: 8,
  },
  jobItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    borderRadius: 10,
    padding: 12,
  },
  jobInfo: {
    flex: 1,
    marginRight: 12,
  },
  jobTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',

  },
  jobClient: {
    fontSize: theme.fontSize.xs,

    marginTop: 2,
  },
  jobActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clockInBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,

    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
});
