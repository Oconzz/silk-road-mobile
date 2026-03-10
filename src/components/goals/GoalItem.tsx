import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import type { Goal } from '../../types/goal';

interface GoalItemProps {
  goal: Goal;
  onComplete?: () => void;
  onVote?: () => void;
  onForceComplete?: () => void;
  onReopen?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  isAdmin?: boolean;
  showJobInfo?: boolean;
  currentUserId?: string;
}

export const GoalItem: React.FC<GoalItemProps> = ({
  goal,
  onComplete,
  onVote,
  onForceComplete,
  onReopen,
  onEdit,
  onDelete,
  canEdit = false,
  isAdmin = false,
  showJobInfo = false,
  currentUserId,
}) => {
  const {colors} = useTheme();
  const isCompleted = goal.status === 'completed';
  const isOverdue = goal.status === 'overdue' || goal.isOverdue;
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePressIn = useCallback(() => {
    // If completed and admin, long press to reopen
    if (isCompleted && isAdmin && onReopen) {
      longPressTimerRef.current = setTimeout(() => {
        Alert.alert(
          'Reopen Goal',
          'Are you sure you want to undo this goal completion? It will return to pending status.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Reopen Goal', 
              style: 'destructive',
              onPress: onReopen 
            },
          ]
        );
      }, 800);
      return;
    }
    
    // If not completed and admin, long press to force complete
    if (!isCompleted && isAdmin && onForceComplete) {
      longPressTimerRef.current = setTimeout(() => {
        Alert.alert(
          'Force Complete Goal',
          'Are you sure you want to force complete this goal? This will bypass the voting requirement.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Force Complete', 
              style: 'destructive',
              onPress: onForceComplete 
            },
          ]
        );
      }, 800);
    }
  }, [isCompleted, isAdmin, onForceComplete, onReopen]);

  const handlePressOut = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePress = useCallback(() => {
    handlePressOut();
    if (goal.isTeamGoal && onVote) {
      onVote();
    } else if (onComplete) {
      onComplete();
    }
  }, [goal.isTeamGoal, onVote, onComplete, handlePressOut]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = () => {
    if (isCompleted) return colors.success;
    if (isOverdue) return colors.error;
    return colors.warning;
  };

  const getStatusIcon = () => {
    if (isCompleted) return 'check-circle';
    if (isOverdue) return 'alert-circle';
    return 'clock';
  };

  const getDeadlineText = () => {
    if (isCompleted && goal.completedOnTime !== undefined) {
      return goal.completedOnTime ? 'Completed on time' : 'Completed late';
    }
    if (isOverdue) {
      return `${Math.abs(goal.daysUntilDeadline)} days overdue`;
    }
    if (goal.daysUntilDeadline === 0) {
      return 'Due today';
    }
    if (goal.daysUntilDeadline === 1) {
      return 'Due tomorrow';
    }
    return `${goal.daysUntilDeadline} days left`;
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.surface, borderColor: colors.border}, isCompleted && styles.containerCompleted]}>
      <Pressable
        style={styles.checkboxArea}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isCompleted || (!onComplete && !onVote)}
      >
        <View style={[
          styles.checkbox,
          {borderColor: colors.border, backgroundColor: colors.surface},
          isCompleted && {backgroundColor: colors.success, borderColor: colors.success},
          isOverdue && !isCompleted && {borderColor: colors.error},
        ]}>
          {isCompleted && (
            <Icon name="check" size={14} color={colors.textLight} />
          )}
        </View>
      </Pressable>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[
            styles.title,
            {color: colors.text},
            isCompleted && styles.titleCompleted,
          ]} numberOfLines={2}>
            {goal.title}
          </Text>
          {canEdit && !isCompleted && (
            <View style={styles.actions}>
              {onEdit && (
                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: colors.background}]} onPress={onEdit}>
                  <Icon name="edit-2" size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: colors.background}]} onPress={onDelete}>
                  <Icon name="trash-2" size={14} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {goal.description && (
          <Text style={[styles.description, {color: colors.textSecondary}]} numberOfLines={2}>
            {goal.description}
          </Text>
        )}

        {(goal.completionBonus || (goal.bonusAmount !== undefined && goal.bonusAmount > 0)) && (
          <View style={[styles.bonusContainer, {backgroundColor: `${colors.success}10`}]}>
            <Icon name="dollar-sign" size={12} color={colors.success} />
            {goal.bonusAmount ? (
              <Text style={[styles.bonusText, {color: colors.accent}]}>{formatCurrency(goal.bonusAmount)}</Text>
            ) : (
              <Text style={[styles.bonusText, {color: colors.accent}]}>{goal.completionBonus}</Text>
            )}
          </View>
        )}

        <View style={styles.footer}>
          <View style={styles.deadlineContainer}>
            <Icon name={getStatusIcon()} size={12} color={getStatusColor()} />
            <Text style={[styles.deadline, { color: getStatusColor() }]}>
              {getDeadlineText()}
            </Text>
            <Text style={[styles.dateText, {color: colors.textSecondary}]}>
              ({formatDate(goal.deadline)})
            </Text>
          </View>

          <View style={styles.assignee}>
            {goal.isTeamGoal ? (
              <>
                <Icon name="users" size={12} color={isCompleted ? colors.success : colors.textSecondary} />
                {isCompleted ? (
                  <Text style={[styles.assigneeText, { color: colors.success, fontWeight: '600' }]}>Complete</Text>
                ) : (
                  <>
                    <Text style={[styles.assigneeText, {color: colors.textSecondary}]}>Team</Text>
                    {goal.totalVotesNeeded !== undefined && goal.votesReceived !== undefined && (
                      <View style={[styles.votesContainer, {backgroundColor: `${colors.accent}10`}]}>
                        <Text style={[styles.votesText, {color: colors.textSecondary}]}>
                          {goal.votesReceived}/{goal.totalVotesNeeded}
                        </Text>
                        {currentUserId && goal.votes?.some(v => v.userId === currentUserId && v.voteComplete) && (
                          <Icon name="check" size={10} color={colors.success} />
                        )}
                      </View>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <Icon name="user" size={12} color={colors.textSecondary} />
                <Text style={[styles.assigneeText, {color: colors.textSecondary}]} numberOfLines={1}>
                  {goal.assignedToUserName || 'All'}
                </Text>
              </>
            )}
          </View>
        </View>

        {isCompleted && goal.completedAt && (
          <View style={[styles.completedInfo, {borderTopColor: colors.border}]}>
            <Text style={[styles.completedText, {color: colors.textSecondary}]}>
              Completed by {goal.completedByUserName || 'Unknown'} on {formatDate(goal.completedAt)}
            </Text>
            {goal.completedOnTime !== undefined && (
              <View style={[
                styles.onTimeBadge,
                goal.completedOnTime ? [styles.onTimeBadgeSuccess, {backgroundColor: `${colors.success}15`}] : [styles.onTimeBadgeLate, {backgroundColor: `${colors.error}15`}],
              ]}>
                <Icon
                  name={goal.completedOnTime ? 'check' : 'clock'}
                  size={10}
                  color={goal.completedOnTime ? colors.success : colors.error}
                />
                <Text style={[
                  styles.onTimeText,
                  { color: goal.completedOnTime ? colors.success : colors.error },
                ]}>
                  {goal.completedOnTime ? 'On Time' : 'Late'}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',

    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,

  },
  containerCompleted: {
    opacity: 0.7,

  },
  checkboxArea: {
    paddingRight: theme.spacing.sm,
    justifyContent: 'flex-start',
    paddingTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,

    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
  },
  checkboxOverdue: {
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: theme.fontSize.md,
    fontWeight: '600',

    marginRight: theme.spacing.sm,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',

  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  actionBtn: {
    padding: theme.spacing.xs,
  },
  description: {
    fontSize: theme.fontSize.sm,

    marginTop: theme.spacing.xs,
  },
  bonusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: theme.spacing.xs,
    paddingVertical: 4,
  },
  bonusText: {
    fontSize: theme.fontSize.xs,

    fontWeight: theme.fontWeight.medium,
  },
  votesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,

    borderRadius: theme.borderRadius.sm,
  },
  votesText: {
    fontSize: theme.fontSize.xs,

    fontWeight: theme.fontWeight.semibold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deadline: {
    fontSize: theme.fontSize.xs,
    fontWeight: '500',
  },
  dateText: {
    fontSize: theme.fontSize.xs,

  },
  assignee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  assigneeText: {
    fontSize: theme.fontSize.xs,

    maxWidth: 80,
  },
  completedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,

  },
  completedText: {
    fontSize: theme.fontSize.xs,

    flex: 1,
  },
  onTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  onTimeBadgeSuccess: {
  },
  onTimeBadgeLate: {
  },
  onTimeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
  },
});
