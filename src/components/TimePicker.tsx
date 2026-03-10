import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
// @ts-ignore - Install library first: yarn add @react-native-picker/picker
import { Picker } from '@react-native-picker/picker';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { BottomSheetModal } from './ui';

interface TimePickerProps {
  visible: boolean;
  hour: number;
  minute: number;
  onHourChange: (hour: number) => void;
  onMinuteChange: (minute: number) => void;
  onClose: () => void;
  title: string;
}

const convert24to12 = (hour24: number): { hour12: number; period: 'AM' | 'PM' } => {
  if (hour24 === 0) return { hour12: 12, period: 'AM' };
  if (hour24 === 12) return { hour12: 12, period: 'PM' };
  if (hour24 > 12) return { hour12: hour24 - 12, period: 'PM' };
  return { hour12: hour24, period: 'AM' };
};

const convert12to24 = (hour12: number, period: 'AM' | 'PM'): number => {
  if (period === 'AM') {
    return hour12 === 12 ? 0 : hour12;
  }
  return hour12 === 12 ? 12 : hour12 + 12;
};

export const TimePicker: React.FC<TimePickerProps> = ({
  visible,
  hour,
  minute,
  onHourChange,
  onMinuteChange,
  onClose,
  title,
}) => {
  const { colors } = useTheme();
  const { hour12: initialHour12, period: initialPeriod } = convert24to12(hour);
  const [displayHour, setDisplayHour] = useState(initialHour12);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initialPeriod);

  useEffect(() => {
    const { hour12, period: newPeriod } = convert24to12(hour);
    setDisplayHour(hour12);
    setPeriod(newPeriod);
  }, [hour]);

  const handleHourChange = (newHour12: number) => {
    setDisplayHour(newHour12);
    const hour24 = convert12to24(newHour12, period);
    onHourChange(hour24);
  };

  const handlePeriodChange = (newPeriod: 'AM' | 'PM') => {
    setPeriod(newPeriod);
    const hour24 = convert12to24(displayHour, newPeriod);
    onHourChange(hour24);
  };

  const hours12 = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <Text style={[styles.title, {color: colors.text}]}>{title}</Text>
      <View style={styles.pickersRow}>
        <View style={styles.pickerContainer}>
          <Text style={[styles.pickerLabel, {color: colors.textSecondary}]}>Hour</Text>
          <Picker
            selectedValue={displayHour}
            onValueChange={handleHourChange}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            {hours12.map((h) => (
              <Picker.Item key={h} label={h.toString()} value={h} />
            ))}
          </Picker>
        </View>
        <Text style={[styles.separator, {color: colors.text}]}>:</Text>
        <View style={styles.pickerContainer}>
          <Text style={[styles.pickerLabel, {color: colors.textSecondary}]}>Minute</Text>
          <Picker
            selectedValue={minute}
            onValueChange={onMinuteChange}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            {minutes.map((m) => (
              <Picker.Item key={m} label={m.toString().padStart(2, '0')} value={m} />
            ))}
          </Picker>
        </View>
        <View style={styles.pickerContainer}>
          <Text style={[styles.pickerLabel, {color: colors.textSecondary}]}>AM/PM</Text>
          <Picker
            selectedValue={period}
            onValueChange={handlePeriodChange}
            style={styles.pickerPeriod}
            itemStyle={styles.pickerItem}
          >
            <Picker.Item label="AM" value="AM" />
            <Picker.Item label="PM" value="PM" />
          </Picker>
        </View>
      </View>
      <TouchableOpacity style={[styles.doneButton, {backgroundColor: colors.accent}]} onPress={onClose}>
        <Text style={[styles.doneButtonText, {color: colors.textLight}]}>Done</Text>
      </TouchableOpacity>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {

    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,

    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  pickersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  pickerContainer: {
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

    marginBottom: theme.spacing.xs,
  },
  picker: {
    width: 100,
    height: 150,
  },
  pickerPeriod: {
    width: 80,
    height: 150,
  },
  pickerItem: {
    fontSize: theme.fontSize.xl,

  },
  separator: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,

    marginHorizontal: theme.spacing.sm,
    marginTop: 20,
  },
  doneButton: {

    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
});
