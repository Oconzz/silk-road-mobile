import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { theme } from '../theme';
import { CalendarPicker } from './ui';
import type {
  RecurrenceFrequency,
  RecurrenceConfig,
  RecurrenceEndType,
  JobOccurrencesResponse,
} from '../types/job';
import {
  RECURRENCE_FREQUENCY_LABELS,
  WEEKDAY_OPTIONS,
  parseRRuleToHuman,
} from '../types/job';

interface RecurrencePickerProps {
  isRecurring?: boolean;
  recurrenceRule?: string;
  onSave: (config: RecurrenceConfig | null) => void;
  occurrences?: JobOccurrencesResponse | null;
  loadingOccurrences?: boolean;
  onLoadOccurrences?: () => void;
}

// Parse an RRULE string into a RecurrenceConfig
const parseRRule = (rrule: string): RecurrenceConfig => {
  const config: RecurrenceConfig = {
    frequency: 'WEEKLY',
    interval: 1,
    endType: 'never',
  };

  const parts = rrule.split(';');
  for (const part of parts) {
    const [key, value] = part.split('=');
    switch (key) {
      case 'FREQ':
        config.frequency = value as RecurrenceFrequency;
        break;
      case 'INTERVAL':
        config.interval = parseInt(value, 10) || 1;
        break;
      case 'BYDAY': {
        const days = value.split(',');
        // Check for Nth weekday pattern (e.g. 1FR, -1MO)
        const nthMatch = days[0]?.match(/^(-?\d)(\w{2})$/);
        if (nthMatch) {
          config.nthWeekday = {
            position: parseInt(nthMatch[1], 10),
            day: nthMatch[2],
          };
        } else {
          config.byDay = days;
        }
        break;
      }
      case 'COUNT':
        config.count = parseInt(value, 10);
        config.endType = 'after_count';
        break;
      case 'UNTIL':
        config.endDate = value;
        config.endType = 'on_date';
        break;
    }
  }

  return config;
};

const NTH_POSITIONS = [
  { label: '1st', value: 1 },
  { label: '2nd', value: 2 },
  { label: '3rd', value: 3 },
  { label: '4th', value: 4 },
  { label: 'Last', value: -1 },
];

const FREQUENCIES: RecurrenceFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
const END_TYPE_OPTIONS: { label: string; value: RecurrenceEndType }[] = [
  { label: 'Never', value: 'never' },
  { label: 'On Date', value: 'on_date' },
  { label: 'After', value: 'after_count' },
];

export const RecurrencePicker: React.FC<RecurrencePickerProps> = ({
  isRecurring = false,
  recurrenceRule,
  onSave,
  occurrences,
  loadingOccurrences,
  onLoadOccurrences,
}) => {
  const { colors } = useTheme();
  const [enabled, setEnabled] = useState(isRecurring);
  const [config, setConfig] = useState<RecurrenceConfig>(() => {
    if (recurrenceRule) {
      return parseRRule(recurrenceRule);
    }
    return { frequency: 'WEEKLY', interval: 1, endType: 'never' };
  });
  const [showOccurrences, setShowOccurrences] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  // Monthly mode: 'day_of_month' or 'nth_weekday'
  const [monthlyMode, setMonthlyMode] = useState<'day_of_month' | 'nth_weekday'>(
    config.nthWeekday ? 'nth_weekday' : 'day_of_month'
  );

  useEffect(() => {
    setEnabled(isRecurring);
    if (recurrenceRule) {
      const parsed = parseRRule(recurrenceRule);
      setConfig(parsed);
      if (parsed.nthWeekday) {
        setMonthlyMode('nth_weekday');
      }
    }
  }, [isRecurring, recurrenceRule]);

  const handleToggle = useCallback(() => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    if (!newEnabled) {
      onSave(null);
    }
  }, [enabled, onSave]);

  const handleFrequencyChange = useCallback((freq: RecurrenceFrequency) => {
    const newConfig = { ...config, frequency: freq };
    // Clear byDay if not weekly
    if (freq !== 'WEEKLY') {
      newConfig.byDay = undefined;
    }
    // Clear nthWeekday if not monthly
    if (freq !== 'MONTHLY') {
      newConfig.nthWeekday = null;
    }
    setConfig(newConfig);
  }, [config]);

  const handleIntervalChange = useCallback((delta: number) => {
    const newInterval = Math.max(1, Math.min(99, config.interval + delta));
    setConfig(prev => ({ ...prev, interval: newInterval }));
  }, [config.interval]);

  const handleDayToggle = useCallback((day: string) => {
    const currentDays = config.byDay || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    setConfig(prev => ({ ...prev, byDay: newDays.length > 0 ? newDays : undefined }));
  }, [config.byDay]);

  const handleEndTypeChange = useCallback((endType: RecurrenceEndType) => {
    setConfig(prev => ({
      ...prev,
      endType,
      endDate: endType === 'on_date' ? prev.endDate : undefined,
      count: endType === 'after_count' ? (prev.count || 10) : undefined,
    }));
  }, []);

  const handleEndDateSelect = useCallback((date: Date) => {
    const formatted = date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    setConfig(prev => ({ ...prev, endDate: formatted }));
    setShowEndDatePicker(false);
  }, []);

  const handleCountChange = useCallback((text: string) => {
    const num = parseInt(text, 10);
    if (!isNaN(num) && num > 0 && num <= 999) {
      setConfig(prev => ({ ...prev, count: num }));
    }
  }, []);

  const handleNthWeekdayPosition = useCallback((position: number) => {
    setConfig(prev => ({
      ...prev,
      nthWeekday: { position, day: prev.nthWeekday?.day || 'MO' },
    }));
  }, []);

  const handleNthWeekdayDay = useCallback((day: string) => {
    setConfig(prev => ({
      ...prev,
      nthWeekday: { position: prev.nthWeekday?.position || 1, day },
    }));
  }, []);

  // "As Needed" removed - a non-recurring job is implicitly "as needed"

  // Auto-notify parent when config changes
  useEffect(() => {
    if (enabled) {
      onSave(config);
    }
  }, [enabled, config]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShowOccurrences = useCallback(() => {
    setShowOccurrences(!showOccurrences);
    if (!showOccurrences && onLoadOccurrences) {
      onLoadOccurrences();
    }
  }, [showOccurrences, onLoadOccurrences]);

  // Build summary text using the shared human-readable helper
  const getSummaryText = (): { line1: string; line2: string } => {
    if (!enabled) return { line1: 'Not recurring', line2: '' };
    // Build a temporary RRULE from current config to feed the parser
    const parts = [`FREQ=${config.frequency}`, `INTERVAL=${config.interval}`];
    if (config.nthWeekday && config.frequency === 'MONTHLY') {
      parts.push(`BYDAY=${config.nthWeekday.position}${config.nthWeekday.day}`);
    } else if (config.byDay && config.byDay.length > 0) {
      parts.push(`BYDAY=${config.byDay.join(',')}`);
    }
    if (config.endType === 'on_date' && config.endDate) { parts.push(`UNTIL=${config.endDate}`); }
    if (config.endType === 'after_count' && config.count) { parts.push(`COUNT=${config.count}`); }
    const { summary, detail } = parseRRuleToHuman(parts.join(';'));
    return { line1: summary, line2: detail };
  };

  // Parse endDate for display
  const getEndDateDisplay = (): string => {
    if (!config.endDate) return 'Select date';
    try {
      const d = new Date(config.endDate.replace(/(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3'));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Select date';
    }
  };

  const getEndDateValue = (): Date => {
    if (!config.endDate) return new Date();
    try {
      return new Date(config.endDate.replace(/(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3'));
    } catch {
      return new Date();
    }
  };

  return (
    <View style={[localStyles.container, { backgroundColor: colors.surface }]}>
      {/* Header with toggle */}
      <TouchableOpacity
        style={localStyles.headerRow}
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <View style={localStyles.headerLeft}>
          <View style={[localStyles.iconContainer, { backgroundColor: `${colors.accent}15` }]}>
            <Icon name="repeat" size={16} color={colors.accent} />
          </View>
          <Text style={[localStyles.headerTitle, { color: colors.text }]}>Recurring</Text>
        </View>
        <View style={[
          localStyles.toggle,
          { backgroundColor: enabled ? colors.accent : colors.border },
        ]}>
          <View style={[
            localStyles.toggleThumb,
            { backgroundColor: '#FFFFFF' },
            enabled && localStyles.toggleThumbActive,
          ]} />
        </View>
      </TouchableOpacity>

      {enabled && (
        <View style={localStyles.configSection}>
          {/* Summary text */}
          {(() => { const { line1, line2 } = getSummaryText(); return (
            <View style={[localStyles.summaryCard, { backgroundColor: `${colors.accent}08`, borderColor: `${colors.accent}20` }]}>
              <Icon name="repeat" size={13} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[localStyles.summaryLine1, { color: colors.text }]}>{line1}</Text>
                {line2 ? <Text style={[localStyles.summaryLine2, { color: colors.textSecondary }]}>{line2}</Text> : null}
              </View>
            </View>
          ); })()}

          {/* Frequency selector */}
          <Text style={[localStyles.label, { color: colors.text }]}>Frequency</Text>
          <View style={localStyles.frequencyRow}>
            {FREQUENCIES.map((freq) => (
              <TouchableOpacity
                key={freq}
                style={[
                  localStyles.frequencyChip,
                  { borderColor: colors.border },
                  config.frequency === freq && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
                onPress={() => handleFrequencyChange(freq)}
              >
                <Text style={[
                  localStyles.frequencyChipText,
                  { color: colors.text },
                  config.frequency === freq && { color: '#FFFFFF' },
                ]}>
                  {RECURRENCE_FREQUENCY_LABELS[freq]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Interval stepper */}
          <Text style={[localStyles.label, { color: colors.text }]}>Every</Text>
          <View style={localStyles.intervalRow}>
            <TouchableOpacity
              style={[localStyles.stepperBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => handleIntervalChange(-1)}
            >
              <Icon name="minus" size={16} color={colors.text} />
            </TouchableOpacity>
            <Text style={[localStyles.intervalValue, { color: colors.text }]}>
              {config.interval}
            </Text>
            <TouchableOpacity
              style={[localStyles.stepperBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => handleIntervalChange(1)}
            >
              <Icon name="plus" size={16} color={colors.text} />
            </TouchableOpacity>
            <Text style={[localStyles.intervalUnit, { color: colors.textSecondary }]}>
              {config.frequency === 'DAILY' ? (config.interval > 1 ? 'days' : 'day')
                : config.frequency === 'WEEKLY' ? (config.interval > 1 ? 'weeks' : 'week')
                : config.frequency === 'MONTHLY' ? (config.interval > 1 ? 'months' : 'month')
                : (config.interval > 1 ? 'years' : 'year')}
            </Text>
          </View>

          {/* Day picker (only for WEEKLY) */}
          {config.frequency === 'WEEKLY' && (
            <>
              <Text style={[localStyles.label, { color: colors.text }]}>On days</Text>
              <View style={localStyles.daysRow}>
                {WEEKDAY_OPTIONS.map((day) => {
                  const isSelected = (config.byDay || []).includes(day.value);
                  return (
                    <TouchableOpacity
                      key={day.value}
                      style={[
                        localStyles.dayChip,
                        { borderColor: colors.border },
                        isSelected && { backgroundColor: colors.accent, borderColor: colors.accent },
                      ]}
                      onPress={() => handleDayToggle(day.value)}
                    >
                      <Text style={[
                        localStyles.dayChipText,
                        { color: colors.text },
                        isSelected && { color: '#FFFFFF' },
                      ]}>
                        {day.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Monthly mode selector */}
          {config.frequency === 'MONTHLY' && (
            <>
              <Text style={[localStyles.label, { color: colors.text }]}>Repeat on</Text>
              <View style={localStyles.frequencyRow}>
                <TouchableOpacity
                  style={[
                    localStyles.frequencyChip,
                    { borderColor: colors.border },
                    monthlyMode === 'day_of_month' && { backgroundColor: colors.accent, borderColor: colors.accent },
                  ]}
                  onPress={() => {
                    setMonthlyMode('day_of_month');
                    setConfig(prev => ({ ...prev, nthWeekday: null }));
                  }}
                >
                  <Text style={[
                    localStyles.frequencyChipText,
                    { color: colors.text },
                    monthlyMode === 'day_of_month' && { color: '#FFFFFF' },
                  ]}>Day of month</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    localStyles.frequencyChip,
                    { borderColor: colors.border },
                    monthlyMode === 'nth_weekday' && { backgroundColor: colors.accent, borderColor: colors.accent },
                  ]}
                  onPress={() => {
                    setMonthlyMode('nth_weekday');
                    setConfig(prev => ({
                      ...prev,
                      nthWeekday: prev.nthWeekday || { position: 1, day: 'MO' },
                    }));
                  }}
                >
                  <Text style={[
                    localStyles.frequencyChipText,
                    { color: colors.text },
                    monthlyMode === 'nth_weekday' && { color: '#FFFFFF' },
                  ]}>Nth weekday</Text>
                </TouchableOpacity>
              </View>

              {/* Nth weekday selector */}
              {monthlyMode === 'nth_weekday' && (
                <>
                  <Text style={[localStyles.label, { color: colors.text, marginTop: 10 }]}>Position</Text>
                  <View style={localStyles.frequencyRow}>
                    {NTH_POSITIONS.map((pos) => {
                      const isSelected = config.nthWeekday?.position === pos.value;
                      return (
                        <TouchableOpacity
                          key={pos.value}
                          style={[
                            localStyles.frequencyChip,
                            { borderColor: colors.border },
                            isSelected && { backgroundColor: colors.accent, borderColor: colors.accent },
                          ]}
                          onPress={() => handleNthWeekdayPosition(pos.value)}
                        >
                          <Text style={[
                            localStyles.frequencyChipText,
                            { color: colors.text },
                            isSelected && { color: '#FFFFFF' },
                          ]}>{pos.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={[localStyles.label, { color: colors.text, marginTop: 10 }]}>Day</Text>
                  <View style={localStyles.daysRow}>
                    {WEEKDAY_OPTIONS.map((day) => {
                      const isSelected = config.nthWeekday?.day === day.value;
                      return (
                        <TouchableOpacity
                          key={day.value}
                          style={[
                            localStyles.dayChip,
                            { borderColor: colors.border },
                            isSelected && { backgroundColor: colors.accent, borderColor: colors.accent },
                          ]}
                          onPress={() => handleNthWeekdayDay(day.value)}
                        >
                          <Text style={[
                            localStyles.dayChipText,
                            { color: colors.text },
                            isSelected && { color: '#FFFFFF' },
                          ]}>{day.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </>
          )}

          {/* Ends selector */}
          {(
            <>
              <Text style={[localStyles.label, { color: colors.text }]}>Ends</Text>
              <View style={localStyles.frequencyRow}>
                {END_TYPE_OPTIONS.map((opt) => {
                  const isSelected = (config.endType || 'never') === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        localStyles.frequencyChip,
                        { borderColor: colors.border },
                        isSelected && { backgroundColor: colors.accent, borderColor: colors.accent },
                      ]}
                      onPress={() => handleEndTypeChange(opt.value)}
                    >
                      <Text style={[
                        localStyles.frequencyChipText,
                        { color: colors.text },
                        isSelected && { color: '#FFFFFF' },
                      ]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* End Date picker */}
              {config.endType === 'on_date' && (
                <TouchableOpacity
                  style={[localStyles.endDateBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Icon name="calendar" size={14} color={colors.accent} />
                  <Text style={[localStyles.endDateText, { color: config.endDate ? colors.text : colors.textSecondary }]}>
                    {getEndDateDisplay()}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Count input */}
              {config.endType === 'after_count' && (
                <View style={localStyles.countRow}>
                  <TextInput
                    style={[localStyles.countInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                    value={config.count?.toString() || '10'}
                    onChangeText={handleCountChange}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={[localStyles.countLabel, { color: colors.textSecondary }]}>Occurrences</Text>
                </View>
              )}
            </>
          )}

          {/* Show occurrences */}
          {isRecurring && recurrenceRule && (
            <TouchableOpacity
              style={[localStyles.occurrencesToggle, { borderColor: colors.border }]}
              onPress={handleShowOccurrences}
            >
              <Icon name="list" size={14} color={colors.accent} />
              <Text style={[localStyles.occurrencesToggleText, { color: colors.accent }]}>
                {showOccurrences ? 'Hide' : 'View'} upcoming occurrences
              </Text>
              <Icon name={showOccurrences ? 'chevron-up' : 'chevron-down'} size={14} color={colors.accent} />
            </TouchableOpacity>
          )}

          {/* Occurrences list - pill chips */}
          {showOccurrences && (
            <View style={{ marginTop: 8 }}>
              {loadingOccurrences ? (
                <ActivityIndicator size="small" color={colors.accent} style={{ padding: 12 }} />
              ) : occurrences && occurrences.occurrences.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  {occurrences.occurrences.slice(0, 12).map((date, index) => {
                    const d = new Date(date);
                    const isPast = d < new Date();
                    const isFirst = index === 0;
                    return (
                      <View
                        key={index}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 7,
                          borderRadius: 10,
                          backgroundColor: isPast ? colors.divider : isFirst ? `${colors.accent}18` : `${colors.accent}09`,
                          borderWidth: isFirst && !isPast ? 1 : 0,
                          borderColor: `${colors.accent}40`,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: isPast ? colors.textSecondary : colors.accent }}>
                          {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                        <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 1 }}>
                          {d.toLocaleDateString('en-US', { weekday: 'short' })}
                        </Text>
                      </View>
                    );
                  })}
                  {occurrences.occurrences.length > 12 && (
                    <View style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: `${colors.accent}09`, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.accent }}>+{occurrences.occurrences.length - 12}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={[localStyles.emptyText, { color: colors.textSecondary }]}>
                  No occurrences found
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* End Date Calendar Picker */}
      <CalendarPicker
        visible={showEndDatePicker}
        onClose={() => setShowEndDatePicker(false)}
        onSelectDate={handleEndDateSelect}
        selectedDate={getEndDateValue()}
        minimumDate={new Date()}
        title="End Date"
      />
    </View>
  );
};

const localStyles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  configSection: {
    paddingTop: theme.spacing.sm,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
  },
  summaryLine1: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  summaryLine2: {
    fontSize: theme.fontSize.xs,
    marginTop: 2,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: theme.spacing.sm,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  frequencyChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  frequencyChipText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intervalValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'center',
  },
  intervalUnit: {
    fontSize: theme.fontSize.sm,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  occurrencesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
  },
  occurrencesToggleText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  occurrencesList: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 8,
    overflow: 'hidden',
  },
  occurrenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  occurrenceText: {
    fontSize: 13,
  },
  emptyText: {
    textAlign: 'center',
    padding: 12,
    fontSize: theme.fontSize.sm,
  },
  endDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  endDateText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  countInput: {
    width: 60,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  countLabel: {
    fontSize: theme.fontSize.sm,
  },
  asNeededRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    marginTop: theme.spacing.md,
    borderTopWidth: 1,
  },
  asNeededTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  asNeededSubtitle: {
    fontSize: theme.fontSize.xs,
    marginTop: 2,
  },
});
