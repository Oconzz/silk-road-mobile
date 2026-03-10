import React, {useState, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Feather';
import {theme} from '../../theme';
import {useTheme} from '../../context/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface CalendarPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  onClear?: () => void;
  selectedDate?: Date;
  minimumDate?: Date;
  title?: string;
  /** Enable time selection after date selection */
  showTime?: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const CalendarPicker: React.FC<CalendarPickerProps> = ({
  visible,
  onClose,
  onSelectDate,
  onClear,
  selectedDate,
  minimumDate,
  title = 'Select Date',
  showTime = false,
}) => {
  const {colors} = useTheme();
  const today = useMemo(() => new Date(), []);
  const initialDate = selectedDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [viewDate, setViewDate] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [tempSelectedDate, setTempSelectedDate] = useState<Date | null>(selectedDate || null);

  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Date>(() => {
    if (selectedDate) {
      return selectedDate;
    }
    // Default to 9:00 AM
    const defaultTime = new Date();
    defaultTime.setHours(9, 0, 0, 0);
    return defaultTime;
  });

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay();

    const days: (number | null)[] = [];

    // Add empty slots for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  }, [currentMonth, currentYear]);

  const goToPreviousMonth = useCallback(() => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  }, [currentMonth, currentYear]);

  const goToNextMonth = useCallback(() => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  }, [currentMonth, currentYear]);

  const isDateDisabled = useCallback((day: number): boolean => {
    if (!minimumDate) return false;
    const date = new Date(currentYear, currentMonth, day);
    date.setHours(0, 0, 0, 0);
    const minDate = new Date(minimumDate);
    minDate.setHours(0, 0, 0, 0);
    return date < minDate;
  }, [minimumDate, currentMonth, currentYear]);

  const isDateSelected = useCallback((day: number): boolean => {
    if (!tempSelectedDate) return false;
    return (
      tempSelectedDate.getDate() === day &&
      tempSelectedDate.getMonth() === currentMonth &&
      tempSelectedDate.getFullYear() === currentYear
    );
  }, [tempSelectedDate, currentMonth, currentYear]);

  const isToday = useCallback((day: number): boolean => {
    return (
      today.getDate() === day &&
      today.getMonth() === currentMonth &&
      today.getFullYear() === currentYear
    );
  }, [today, currentMonth, currentYear]);

  const handleDayPress = useCallback((day: number) => {
    if (isDateDisabled(day)) return;
    // Preserve time from selectedTime if showTime is enabled
    const hours = showTime ? selectedTime.getHours() : 12;
    const minutes = showTime ? selectedTime.getMinutes() : 0;
    const newDate = new Date(currentYear, currentMonth, day, hours, minutes, 0);
    setTempSelectedDate(newDate);
  }, [currentYear, currentMonth, isDateDisabled, showTime, selectedTime]);

  const handleConfirm = useCallback(() => {
    if (tempSelectedDate) {
      // Combine date with selected time if showTime is enabled
      if (showTime) {
        const finalDate = new Date(tempSelectedDate);
        finalDate.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
        onSelectDate(finalDate);
      } else {
        onSelectDate(tempSelectedDate);
      }
    }
    setShowTimePicker(false);
    onClose();
  }, [tempSelectedDate, onSelectDate, onClose, showTime, selectedTime]);

  const handleTimeChange = useCallback((event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (date) {
      setSelectedTime(date);
      // Update tempSelectedDate with new time
      if (tempSelectedDate) {
        const newDate = new Date(tempSelectedDate);
        newDate.setHours(date.getHours(), date.getMinutes(), 0, 0);
        setTempSelectedDate(newDate);
      }
    }
  }, [tempSelectedDate]);

  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, []);

  const handleClear = useCallback(() => {
    setTempSelectedDate(null);
    setShowTimePicker(false);
    if (onClear) {
      onClear();
    }
    onClose();
  }, [onClear, onClose]);

  const handleCancel = useCallback(() => {
    setTempSelectedDate(selectedDate || null);
    setShowTimePicker(false);
    onClose();
  }, [selectedDate, onClose]);

  // Check if we can go to previous month
  const canGoPrevious = useMemo(() => {
    if (!minimumDate) return true;
    const prevMonth = new Date(currentYear, currentMonth - 1, 1);
    const minMonth = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), 1);
    return prevMonth >= minMonth;
  }, [minimumDate, currentMonth, currentYear]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleCancel}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={[styles.container, {backgroundColor: colors.surface}]}>
            {/* Header */}
            <View style={[styles.header, {backgroundColor: colors.surface}, {borderBottomColor: colors.border}]}>
              <TouchableOpacity onPress={handleCancel}>
                <Text style={[styles.cancelText, {color: colors.textSecondary}]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.title, {color: colors.text}]}>{title}</Text>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 16}}>
                {onClear && selectedDate && (
                  <TouchableOpacity onPress={handleClear}>
                    <Text style={[styles.cancelText, {color: colors.error}]}>Clear</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleConfirm}>
                  <Text style={[styles.doneText, {color: colors.accent}]}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Month Navigation */}
            <View style={styles.monthNav}>
              <TouchableOpacity                 onPress={goToPreviousMonth}
                disabled={!canGoPrevious}
                style={[styles.navButton, {backgroundColor: colors.surface}, !canGoPrevious && styles.navButtonDisabled]}
              >
                <Icon name="chevron-left" size={24} color={canGoPrevious ? colors.text : colors.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.monthYear, {color: colors.text}]}>
                {MONTHS[currentMonth]} {currentYear}
              </Text>
              <TouchableOpacity onPress={goToNextMonth} style={[styles.navButton, {backgroundColor: colors.surface}]}>
                <Icon name="chevron-right" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Day Headers */}
            <View style={[styles.daysHeader, {backgroundColor: colors.surface}]}>
              {DAYS.map((day) => (
                <View key={day} style={styles.dayHeaderCell}>
                  <Text style={[styles.dayHeaderText, {color: colors.textSecondary}]}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => (
                <View key={index} style={styles.dayCell}>
                  {day !== null ? (
                    <TouchableOpacity
                      style={[
                        styles.dayButton,
                        isDateSelected(day) && [styles.dayButtonSelected, {backgroundColor: colors.accent}],
                        isToday(day) && !isDateSelected(day) && [styles.dayButtonToday, {borderColor: colors.accent}],
                        isDateDisabled(day) && styles.dayButtonDisabled,
                      ]}
                      onPress={() => handleDayPress(day)}
                      disabled={isDateDisabled(day)}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          {color: colors.text},
                          isDateSelected(day) && [styles.dayTextSelected, {color: '#FFFFFF'}],
                          isToday(day) && !isDateSelected(day) && [styles.dayTextToday, {color: colors.accent}],
                          isDateDisabled(day) && [styles.dayTextDisabled, {color: colors.textSecondary}],
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>

            {/* Selected Date Display */}
            {tempSelectedDate && (
              <View style={[styles.selectedDisplay, {borderTopColor: colors.border, backgroundColor: `${colors.accent}10`}]}>
                <Text style={[styles.selectedLabel, {color: colors.textSecondary}]}>Selected:</Text>
                <Text style={[styles.selectedDate, {color: colors.accent}]}>
                  {tempSelectedDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  {showTime && ` at ${formatTime(selectedTime)}`}
                </Text>
              </View>
            )}

            {/* Time Picker Section */}
            {showTime && tempSelectedDate && (
              <View style={[styles.timeSection, {backgroundColor: colors.surface, borderTopColor: colors.border}]}>
                <Text style={[styles.timeLabel, {color: colors.textSecondary}]}>Time</Text>
                <TouchableOpacity
                  style={[styles.timeButton, {backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: theme.borderRadius.md}]}
                  onPress={() => setShowTimePicker(!showTimePicker)}
                >
                  <Icon name="clock" size={18} color={colors.accent} />
                  <Text style={[styles.timeButtonText, {color: colors.text}]}>{formatTime(selectedTime)}</Text>
                  <Icon name={showTimePicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Native Time Picker */}
            {showTimePicker && (
              Platform.OS === 'ios' ? (
                <View style={[styles.iosTimePicker, {borderTopColor: colors.border, backgroundColor: colors.surface}]}>
                  <DateTimePicker
                    value={selectedTime}
                    mode="time"
                    display="spinner"
                    onChange={handleTimeChange}
                    textColor={colors.text}
                    themeVariant={colors.background === '#FFFFFF' || colors.background === '#F9FAFB' ? 'light' : 'dark'}
                  />
                </View>
              ) : (
                <DateTimePicker
                  value={selectedTime}
                  mode="time"
                  display="default"
                  onChange={handleTimeChange}
                />
              )
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const CELL_SIZE = (SCREEN_WIDTH - 80) / 7;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {

    borderRadius: theme.borderRadius.xl,
    width: SCREEN_WIDTH - 40,
    maxWidth: 360,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,

  },
  cancelText: {
    fontSize: theme.fontSize.md,

  },
  title: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  doneText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  navButton: {
    padding: theme.spacing.xs,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  monthYear: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,

  },
  daysHeader: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  dayHeaderCell: {
    width: CELL_SIZE,
    alignItems: 'center',
  },
  dayHeaderText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButton: {
    width: CELL_SIZE - 8,
    height: CELL_SIZE - 8,
    borderRadius: (CELL_SIZE - 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonSelected: {
  },
  dayButtonToday: {
    borderWidth: 2,

  },
  dayButtonDisabled: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: theme.fontSize.md,

  },
  dayTextSelected: {

    fontWeight: theme.fontWeight.semibold,
  },
  dayTextToday: {

    fontWeight: theme.fontWeight.semibold,
  },
  dayTextDisabled: {
  },
  selectedDisplay: {
    padding: theme.spacing.md,
    borderTopWidth: 1,

  },
  selectedLabel: {
    fontSize: theme.fontSize.sm,

    marginBottom: 4,
  },
  selectedDate: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

  },
  // Time Picker Styles
  timeSection: {
    padding: theme.spacing.md,
    borderTopWidth: 1,

  },
  timeLabel: {
    fontSize: theme.fontSize.sm,

    marginBottom: theme.spacing.sm,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  timeButtonText: {
    flex: 1,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

  },
  iosTimePicker: {

    borderTopWidth: 1,

  },
});

export default CalendarPicker;
