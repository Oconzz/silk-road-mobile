import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import RNShare from 'react-native-share';
import { useTheme } from '../../context/ThemeContext';
import { theme } from '../../theme';
import { squarePaymentService } from '../../services/api/domain/squarePayment';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';

type ExportPaymentsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ExportPayments'>;
};

const getDefaultStartDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatDisplayDate = (date: Date) => {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatApiDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const ExportPaymentsScreen: React.FC<ExportPaymentsScreenProps> = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleStartDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }
    if (date) {
      setStartDate(date);
      if (Platform.OS === 'ios') {
        setShowStartPicker(false);
      }
    }
  };

  const handleEndDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }
    if (date) {
      setEndDate(date);
      if (Platform.OS === 'ios') {
        setShowEndPicker(false);
      }
    }
  };

  const handleExport = async () => {
    if (startDate > endDate) {
      Alert.alert('Invalid Range', 'Start date must be before end date.');
      return;
    }

    try {
      setIsExporting(true);
      const filePath = await squarePaymentService.exportPaymentsCsv(
        formatApiDate(startDate),
        formatApiDate(endDate),
      );

      await RNShare.open({
        url: Platform.OS === 'android' ? `file://${filePath}` : filePath,
        type: 'text/csv',
        filename: `silkroad-payments-${formatApiDate(startDate)}-${formatApiDate(endDate)}.csv`,
      });
    } catch (error: any) {
      // User cancelled share sheet
      if (error?.message?.includes('User did not share')) {
        return;
      }
      Alert.alert(
        'Export Failed',
        error?.message || 'Failed to export payments. Please try again.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.surface}, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Export Payments</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Description */}
        <View style={[styles.infoCard, { backgroundColor: `${colors.accent}10` }]}>
          <Icon name="info" size={20} color={colors.accent} />
          <Text style={[styles.infoText, { color: colors.text }]}>
            Export your payment history as a CSV file compatible with QuickBooks. Select a date range and tap export.
          </Text>
        </View>

        {/* Date Range Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DATE RANGE</Text>

          {/* Start Date */}
          <TouchableOpacity
            style={[styles.dateRow, { borderBottomColor: colors.divider }]}
            onPress={() => {
              if (showStartPicker) {
                setShowStartPicker(false);
              } else {
                setShowEndPicker(false);
                setShowStartPicker(true);
              }
            }}
          >
            <View style={styles.dateLeft}>
              <Icon name="calendar" size={18} color={colors.textSecondary} />
              <Text style={[styles.dateLabel, { color: colors.text }]}>Start Date</Text>
            </View>
            <Text style={[styles.dateValue, { color: colors.accent }]}>
              {formatDisplayDate(startDate)}
            </Text>
          </TouchableOpacity>

          {showStartPicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={handleStartDateChange}
              maximumDate={endDate}
              accentColor={colors.accent}
              themeVariant={isDark ? 'dark' : 'light'}
              style={{ backgroundColor: colors.surface }}
            />
          )}

          {/* End Date */}
          <TouchableOpacity
            style={[styles.dateRow, {borderBottomColor: colors.border}]}
            onPress={() => {
              if (showEndPicker) {
                setShowEndPicker(false);
              } else {
                setShowStartPicker(false);
                setShowEndPicker(true);
              }
            }}
          >
            <View style={styles.dateLeft}>
              <Icon name="calendar" size={18} color={colors.textSecondary} />
              <Text style={[styles.dateLabel, { color: colors.text }]}>End Date</Text>
            </View>
            <Text style={[styles.dateValue, { color: colors.accent }]}>
              {formatDisplayDate(endDate)}
            </Text>
          </TouchableOpacity>

          {showEndPicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={handleEndDateChange}
              minimumDate={startDate}
              maximumDate={new Date()}
              accentColor={colors.accent}
              themeVariant={isDark ? 'dark' : 'light'}
              style={{ backgroundColor: colors.surface }}
            />
          )}
        </View>

        {/* Export Button */}
        <TouchableOpacity
          style={[styles.exportButton, { backgroundColor: colors.accent }, isExporting && styles.exportButtonDisabled]}
          onPress={handleExport}
          disabled={isExporting}
          activeOpacity={0.8}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color={colors.textLight} />
          ) : (
            <>
              <Icon name="download" size={20} color={colors.textLight} />
              <Text style={[styles.exportButtonText, { color: colors.textLight }]}>Export to CSV</Text>
            </>
          )}
        </TouchableOpacity>

        {/* QuickBooks Instructions */}
        <View style={[styles.instructionsCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.instructionsTitle, { color: colors.text }]}>How to import in QuickBooks</Text>
          <View style={styles.instructionStep}>
            <Text style={[styles.stepNumber, { color: colors.accent }]}>1.</Text>
            <Text style={[styles.stepText, { color: colors.textSecondary }]}>
              Export and save the CSV file
            </Text>
          </View>
          <View style={styles.instructionStep}>
            <Text style={[styles.stepNumber, { color: colors.accent }]}>2.</Text>
            <Text style={[styles.stepText, { color: colors.textSecondary }]}>
              In QuickBooks, go to Banking &gt; File Upload
            </Text>
          </View>
          <View style={styles.instructionStep}>
            <Text style={[styles.stepNumber, { color: colors.accent }]}>3.</Text>
            <Text style={[styles.stepText, { color: colors.textSecondary }]}>
              Map Date, Description, and Amount columns
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  infoText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
  },
  section: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
    ...theme.shadow.sm,
  },
  sectionTitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,

  },
  dateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dateLabel: {
    fontSize: theme.fontSize.md,
  },
  dateValue: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  exportButtonDisabled: {
    opacity: 0.7,
  },
  exportButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
  },
  instructionsCard: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadow.sm,
  },
  instructionsTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginBottom: theme.spacing.md,
  },
  instructionStep: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  stepNumber: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
  },
});
