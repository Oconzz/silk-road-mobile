import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useGoal } from '../../context/GoalContext';
import { usePermissions } from '../../context/PermissionContext';
import { useAuth } from '../../context/AuthContext';
import { GoalItem } from './GoalItem';
import { CreateGoalModal } from './CreateGoalModal';
import type { Goal } from '../../types/goal';

interface GoalSectionProps {
  jobId: string;
  collapsed?: boolean;
  onToggle?: () => void;
  readOnly?: boolean;
}

export const GoalSection: React.FC<GoalSectionProps> = ({
  jobId,
  collapsed = false,
  onToggle,
  readOnly = false,
}) => {
  const {colors} = useTheme();
  const {
    jobGoals,
    jobGoalsSummary,
    isLoading,
    loadJobGoals,
    loadJobGoalsSummary,
    completeGoal,
    voteGoalComplete,
    forceCompleteGoal,
    reopenGoal,
    deleteGoal,
  } = useGoal();

  const { hasPermission } = usePermissions();
  const { user, currentCompany } = useAuth();
  const canManageGoals = hasPermission('jobs.manage_status'); // Leaders and above
  const isAdmin = currentCompany?.role === 'Admin' || currentCompany?.role === 'SuperAdmin';
  const currentUserId = user?.userId;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  
  // Track initial load vs subsequent updates to prevent flicker
  const hasLoadedRef = useRef(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!hasLoadedRef.current) {
        setInitialLoading(true);
      }
      await Promise.all([loadJobGoals(jobId), loadJobGoalsSummary(jobId)]);
      hasLoadedRef.current = true;
      setInitialLoading(false);
    };
    loadData();
  }, [jobId, loadJobGoals, loadJobGoalsSummary]);

  const handleCompleteGoal = async (goalId: string) => {
    try {
      await completeGoal(goalId);
      loadJobGoalsSummary(jobId);
    } catch (err) {
      console.error('Failed to complete goal:', err);
    }
  };

  const handleVoteGoal = async (goalId: string) => {
    try {
      await voteGoalComplete(goalId);
      loadJobGoalsSummary(jobId);
    } catch (err) {
      console.error('Failed to vote on goal:', err);
    }
  };

  const handleForceCompleteGoal = async (goalId: string) => {
    try {
      await forceCompleteGoal(goalId);
      loadJobGoalsSummary(jobId);
    } catch (err) {
      console.error('Failed to force complete goal:', err);
    }
  };

  const handleReopenGoal = async (goalId: string) => {
    try {
      await reopenGoal(goalId);
      loadJobGoalsSummary(jobId);
    } catch (err) {
      console.error('Failed to reopen goal:', err);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      await deleteGoal(goalId);
      loadJobGoalsSummary(jobId);
    } catch (err) {
      console.error('Failed to delete goal:', err);
    }
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingGoal(null);
  };

  const handleGoalSaved = () => {
    loadJobGoals(jobId);
    loadJobGoalsSummary(jobId);
    handleCloseModal();
  };

  const filteredGoals = jobGoals.filter(goal => {
    if (filter === 'all') return true;
    if (filter === 'pending') return goal.status !== 'completed';
    if (filter === 'completed') return goal.status === 'completed';
    return true;
  });

  const pendingCount = jobGoals.filter(g => g.status !== 'completed').length;
  const completedCount = jobGoals.filter(g => g.status === 'completed').length;

  return (
    <View style={styles.container}>
      <TouchableOpacity         style={[styles.header, {backgroundColor: colors.surface}]}
        onPress={onToggle}
        disabled={!onToggle}
        activeOpacity={onToggle ? 0.7 : 1}
      >
        <View style={styles.headerLeft}>
          <Icon name="target" size={18} color={colors.accent} />
          <Text style={[styles.title, {color: colors.text}]}>Goals</Text>
          {jobGoalsSummary && (
            <View style={[styles.badge, {backgroundColor: `${colors.accent}15`}]}>
              <Text style={[styles.badgeText, {color: colors.accent}]}>
                {jobGoalsSummary.completedGoals}/{jobGoalsSummary.totalGoals}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          {canManageGoals && !readOnly && (
            <TouchableOpacity
              style={[styles.addBtn, {backgroundColor: colors.accent}]}
              onPress={() => setShowCreateModal(true)}
            >
              <Icon name="plus" size={16} color={colors.textLight} />
            </TouchableOpacity>
          )}
          {onToggle && (
            <Icon
              name={collapsed ? 'chevron-down' : 'chevron-up'}
              size={20}
              color={colors.textSecondary}
            />
          )}
        </View>
      </TouchableOpacity>

      {!collapsed && (
        <View style={styles.content}>
          {jobGoalsSummary && jobGoalsSummary.totalGoals > 0 && (
            <View style={styles.summaryRow}>
              <View style={styles.progressContainer}>
                <View style={[styles.progressTrack, {backgroundColor: colors.background}]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${jobGoalsSummary.completionRate}%` },
                    ]}
                  />
                </View>
                <Text style={[styles.progressText, {color: colors.accent}]}>
                  {jobGoalsSummary.completionRate}% complete
                </Text>
              </View>
              {jobGoalsSummary.overdueGoals > 0 && (
                <View style={[styles.overdueIndicator, {backgroundColor: `${colors.error}10`}]}>
                  <Icon name="alert-circle" size={12} color={colors.error} />
                  <Text style={[styles.overdueText, {color: colors.error}]}>
                    {jobGoalsSummary.overdueGoals} overdue
                  </Text>
                </View>
              )}
            </View>
          )}

          {jobGoals.length > 0 && (
            <View style={styles.filterRow}>
              <TouchableOpacity                 style={[styles.filterBtn, {backgroundColor: colors.surface}, filter === 'all' && [styles.filterBtnActive, {backgroundColor: colors.accent}]]}
                onPress={() => setFilter('all')}
              >
                <Text style={[styles.filterText, {color: colors.textSecondary}, filter === 'all' && {color: colors.textLight}]}>
                  All ({jobGoals.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity                 style={[styles.filterBtn, {backgroundColor: colors.surface}, filter === 'pending' && [styles.filterBtnActive, {backgroundColor: colors.accent}]]}
                onPress={() => setFilter('pending')}
              >
                <Text style={[styles.filterText, {color: colors.textSecondary}, filter === 'pending' && {color: colors.textLight}]}>
                  Pending ({pendingCount})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity                 style={[styles.filterBtn, {backgroundColor: colors.surface}, filter === 'completed' && [styles.filterBtnActive, {backgroundColor: colors.accent}]]}
                onPress={() => setFilter('completed')}
              >
                <Text style={[styles.filterText, {color: colors.textSecondary}, filter === 'completed' && {color: colors.textLight}]}>
                  Done ({completedCount})
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {initialLoading ? (
            <View style={[styles.loadingContainer, {backgroundColor: colors.surface}]}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : filteredGoals.length === 0 ? (
            <View style={[styles.emptyContainer, {backgroundColor: colors.surface}]}>
              <Icon name="target" size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyText, {color: colors.textSecondary}]}>
                {jobGoals.length === 0
                  ? 'No goals yet'
                  : 'No goals match the filter'}
              </Text>
              {canManageGoals && jobGoals.length === 0 && !readOnly && (
                <TouchableOpacity
                  style={[styles.emptyAddBtn, {backgroundColor: colors.accent, borderColor: colors.accent}]}
                  onPress={() => setShowCreateModal(true)}
                >
                  <Icon name="plus" size={14} color={colors.textLight} />
                  <Text style={[styles.emptyAddText, {color: colors.textLight}]}>Add Goal</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.goalsList}>
              {filteredGoals.map(goal => (
                <GoalItem
                  key={goal.id}
                  goal={goal}
                  onComplete={!readOnly ? () => handleCompleteGoal(goal.id) : undefined}
                  onVote={!readOnly && goal.isTeamGoal ? () => handleVoteGoal(goal.id) : undefined}
                  onForceComplete={!readOnly && isAdmin ? () => handleForceCompleteGoal(goal.id) : undefined}
                  onReopen={!readOnly && isAdmin ? () => handleReopenGoal(goal.id) : undefined}
                  onEdit={canManageGoals && !readOnly ? () => handleEditGoal(goal) : undefined}
                  onDelete={canManageGoals && !readOnly ? () => handleDeleteGoal(goal.id) : undefined}
                  canEdit={canManageGoals && !readOnly}
                  isAdmin={isAdmin}
                  currentUserId={currentUserId}
                />
              ))}
            </View>
          )}
        </View>
      )}

      <CreateGoalModal
        visible={showCreateModal}
        onClose={handleCloseModal}
        onSave={handleGoalSaved}
        jobId={jobId}
        editingGoal={editingGoal}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',

  },
  badge: {

    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  badgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',

  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    marginTop: theme.spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  progressContainer: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  progressTrack: {
    height: 6,

    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',

    borderRadius: 3,
  },
  progressText: {
    fontSize: theme.fontSize.xs,

  },
  overdueIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,

    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  overdueText: {
    fontSize: theme.fontSize.xs,

    fontWeight: '500',
  },
  filterRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  filterBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,

  },
  filterBtnActive: {
  },
  filterText: {
    fontSize: theme.fontSize.xs,

  },
  filterTextActive: {

    fontWeight: '600',
  },
  loadingContainer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
  },
  emptyText: {
    fontSize: theme.fontSize.sm,

    marginTop: theme.spacing.sm,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    borderStyle: 'dashed',
  },
  emptyAddText: {
    fontSize: theme.fontSize.sm,

    fontWeight: '500',
  },
  goalsList: {
    gap: theme.spacing.sm,
  },
});
