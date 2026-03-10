import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useTimeCard } from '../context/TimeCardContext';
import { formatDuration } from '../types/timeCard';

interface ClockInOutWidgetProps {
  onViewHistory?: () => void;
  jobId?: string;
  jobName?: string;
  compact?: boolean;
}

export const ClockInOutWidget: React.FC<ClockInOutWidgetProps> = ({ 
  onViewHistory, 
  jobId, 
  jobName,
  compact: _compact = false 
}) => {
  const {colors} = useTheme();
  const { activeTimeCard, isClockedIn, loading, clockIn, clockOut, weeklySummary } = useTimeCard();
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time every minute when clocked in
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
    const interval = setInterval(updateElapsed, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [isClockedIn, activeTimeCard]);

  const handleClockIn = async () => {
    try {
      await clockIn({ jobId, jobName });
    } catch {
      Alert.alert('Error', 'Failed to clock in. Please try again.');
    }
  };

  const handleClockOut = () => {
    Alert.alert(
      'Clock Out',
      'Are you sure you want to clock out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clock Out',
          onPress: async () => {
            try {
              await clockOut();
            } catch {
              Alert.alert('Error', 'Failed to clock out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatClockInTime = () => {
    if (!activeTimeCard) return '';
    const date = new Date(activeTimeCard.clockInTime);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.surface, borderColor: colors.border}]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="clock" size={20} color={colors.primary} />
          <Text style={[styles.title, {color: colors.text}]}>Time Tracking</Text>
        </View>
        {onViewHistory && (
          <TouchableOpacity onPress={onViewHistory} style={styles.historyBtn}>
            <Text style={[styles.historyBtnText, {color: colors.primary}]}>History</Text>
            <Icon name="chevron-right" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {isClockedIn ? (
        <View style={styles.clockedInContainer}>
          <View style={styles.statusRow}>
            <View style={styles.statusIndicator}>
              <View style={[styles.statusDot, {backgroundColor: colors.success}]} />
              <Text style={[styles.statusText, {color: colors.success}]}>Clocked In</Text>
            </View>
            <Text style={[styles.clockInTime, {color: colors.textSecondary}]}>since {formatClockInTime()}</Text>
          </View>

          <View style={[styles.elapsedContainer, {backgroundColor: colors.background}]}>
            <Text style={[styles.elapsedLabel, {color: colors.textSecondary}]}>Time Worked</Text>
            <Text style={[styles.elapsedValue, {color: colors.text}]}>{formatDuration(elapsedTime)}</Text>
          </View>

          {activeTimeCard?.jobName && (
            <View style={styles.jobInfo}>
              <Icon name="briefcase" size={14} color={colors.textSecondary} />
              <Text style={[styles.jobName, {color: colors.textSecondary}]}>{activeTimeCard.jobName}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.clockButton, styles.clockOutButton, {backgroundColor: colors.error}]}
            onPress={handleClockOut}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <>
                <Icon name="log-out" size={20} color="#fff" />
                <Text style={styles.clockButtonText}>Clock Out</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.clockedOutContainer}>
          <View style={[styles.summaryRow, {backgroundColor: colors.surface}]}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, {color: colors.text}]}>
                {weeklySummary ? formatDuration(weeklySummary.totalHours) : '0h'}
              </Text>
              <Text style={[styles.summaryLabel, {color: colors.textSecondary}]}>This Week</Text>
            </View>
            <View style={[styles.summaryDivider, {backgroundColor: colors.border}]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, {color: colors.text}]}>{weeklySummary?.totalDays || 0}</Text>
              <Text style={[styles.summaryLabel, {color: colors.textSecondary}]}>Days</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.clockButton, styles.clockInButton, {backgroundColor: colors.success}]}
            onPress={handleClockIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="log-in" size={20} color="#fff" />
                <Text style={styles.clockButtonText}>Clock In</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {

    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,

  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',

  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyBtnText: {
    fontSize: 14,

    fontWeight: '500',
  },
  clockedInContainer: {},
  clockedOutContainer: {},
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,

  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',

  },
  clockInTime: {
    fontSize: 13,

  },
  elapsedContainer: {
    alignItems: 'center',
    paddingVertical: 16,

    borderRadius: 12,
    marginBottom: 12,
  },
  elapsedLabel: {
    fontSize: 12,

    marginBottom: 4,
  },
  elapsedValue: {
    fontSize: 32,
    fontWeight: '700',

  },
  jobInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  jobName: {
    fontSize: 13,

  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 30,

  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',

  },
  summaryLabel: {
    fontSize: 12,

    marginTop: 4,
  },
  clockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  clockInButton: {
  },
  clockOutButton: {
  },
  clockButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
