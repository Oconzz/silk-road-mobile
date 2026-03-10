import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useGoal } from '../context/GoalContext';
import { GoalItem } from '../components/goals';
import { ScreenHeader } from '../components/ui';
import type { Goal } from '../types/goal';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

type FilterType = 'all' | 'pending' | 'overdue' | 'completed';

export const MyGoalsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    myGoals,
    userGoalsSummary,
    isLoading,
    loadMyGoals,
    loadUserGoalsSummary,
    completeGoal,
  } = useGoal();

  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMyGoals();
    loadUserGoalsSummary();
  }, [loadMyGoals, loadUserGoalsSummary]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadMyGoals(), loadUserGoalsSummary()]);
    setRefreshing(false);
  }, [loadMyGoals, loadUserGoalsSummary]);

  const handleCompleteGoal = async (goalId: string) => {
    try {
      await completeGoal(goalId);
      loadUserGoalsSummary();
    } catch (err) {
      console.error('Failed to complete goal:', err);
    }
  };

  const filteredGoals = myGoals.filter(goal => {
    switch (filter) {
      case 'pending':
        return goal.status === 'pending';
      case 'overdue':
        return goal.status === 'overdue' || goal.isOverdue;
      case 'completed':
        return goal.status === 'completed';
      default:
        return true;
    }
  });

  const getFilterCount = (type: FilterType) => {
    switch (type) {
      case 'pending':
        return userGoalsSummary?.pending || 0;
      case 'overdue':
        return userGoalsSummary?.overdue || 0;
      case 'completed':
        return userGoalsSummary?.completed || 0;
      default:
        return userGoalsSummary?.totalAssigned || 0;
    }
  };

  const renderFilterButton = (type: FilterType, label: string) => (
    <TouchableOpacity
      style={[styles.filterBtn, {backgroundColor: colors.surface}, filter === type && [styles.filterBtnActive, {backgroundColor: colors.accent}]]}
      onPress={() => setFilter(type)}
    >
      <Text style={[styles.filterText, {color: colors.textSecondary}, filter === type && styles.filterTextActive]}>
        {label} ({getFilterCount(type)})
      </Text>
    </TouchableOpacity>
  );

  const renderGoalItem = ({ item }: { item: Goal }) => (
    <GoalItem
      goal={item}
      onComplete={() => handleCompleteGoal(item.id)}
      showJobInfo
    />
  );

  const renderHeader = () => (
    <View style={styles.headerContent}>
      {userGoalsSummary && (
        <View style={[styles.summaryCard, {backgroundColor: colors.surface}]}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, {color: colors.text}]}>{userGoalsSummary.totalAssigned}</Text>
              <Text style={[styles.summaryLabel, {color: colors.textSecondary}]}>Total</Text>
            </View>
            <View style={[styles.summaryDivider, {backgroundColor: colors.divider}]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.success }]}>
                {userGoalsSummary.completed}
              </Text>
              <Text style={[styles.summaryLabel, {color: colors.textSecondary}]}>Completed</Text>
            </View>
            <View style={[styles.summaryDivider, {backgroundColor: colors.divider}]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.warning }]}>
                {userGoalsSummary.pending}
              </Text>
              <Text style={[styles.summaryLabel, {color: colors.textSecondary}]}>Pending</Text>
            </View>
            <View style={[styles.summaryDivider, {backgroundColor: colors.divider}]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.error }]}>
                {userGoalsSummary.overdue}
              </Text>
              <Text style={[styles.summaryLabel, {color: colors.textSecondary}]}>Overdue</Text>
            </View>
          </View>

          {userGoalsSummary.totalAssigned > 0 && (
            <View style={[styles.progressSection, {backgroundColor: colors.surface}]}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressTitle, {color: colors.textSecondary}]}>Completion Rate</Text>
                <Text style={[styles.progressPercent, {color: colors.text}]}>{userGoalsSummary.completionRate}%</Text>
              </View>
              <View style={[styles.progressTrack, {backgroundColor: colors.background}]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${userGoalsSummary.completionRate}%` },
                  ]}
                />
              </View>
              {userGoalsSummary.completed > 0 && (
                <Text style={[styles.onTimeText, {color: colors.textSecondary}]}>
                  {userGoalsSummary.onTimeRate}% completed on time
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      <View style={styles.filterRow}>
        {renderFilterButton('all', 'All')}
        {renderFilterButton('pending', 'Pending')}
        {renderFilterButton('overdue', 'Overdue')}
        {renderFilterButton('completed', 'Done')}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={[styles.emptyContainer, {backgroundColor: colors.surface}]}>
      <Icon name="target" size={48} color={colors.textSecondary} />
      <Text style={[styles.emptyTitle, {color: colors.text}]}>
        {filter === 'all' ? 'No goals assigned' : `No ${filter} goals`}
      </Text>
      <Text style={[styles.emptySubtitle, {color: colors.textSecondary}]}>
        {filter === 'all'
          ? 'Goals assigned to you will appear here'
          : 'Try changing the filter to see other goals'}
      </Text>
    </View>
  );

  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="My Goals"
        onBack={() => navigation.goBack()}
      />

      {isLoading && myGoals.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredGoals}
          keyExtractor={item => item.id}
          renderItem={renderGoalItem}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  headerContent: {
    marginBottom: theme.spacing.md,
  },
  summaryCard: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',

  },
  summaryLabel: {
    fontSize: theme.fontSize.xs,

    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 30,

  },
  progressSection: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,

  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  progressTitle: {
    fontSize: theme.fontSize.sm,

  },
  progressPercent: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',

  },
  progressTrack: {
    height: 8,

    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',

    borderRadius: 4,
  },
  onTimeText: {
    fontSize: theme.fontSize.xs,

    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,

    alignItems: 'center',
  },
  filterBtnActive: {
  },
  filterText: {
    fontSize: theme.fontSize.xs,

  },
  filterTextActive: {

    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',

    marginTop: theme.spacing.md,
  },
  emptySubtitle: {
    fontSize: theme.fontSize.sm,

    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
});
