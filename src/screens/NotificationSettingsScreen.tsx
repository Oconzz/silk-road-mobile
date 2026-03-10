import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationSettings'>;

interface SettingRowProps {
  icon: string;
  title: string;
  description: string;
  value: boolean;
  onToggle: (val: boolean) => void;
  disabled?: boolean;
  colors: any;
}

const SettingRow: React.FC<SettingRowProps> = ({
  icon,
  title,
  description,
  value,
  onToggle,
  disabled,
  colors,
}) => (
  <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
    <View style={styles.settingIcon}>
      <Icon name={icon} size={20} color={disabled ? colors.textSecondary : colors.primary} />
    </View>
    <View style={styles.settingContent}>
      <Text style={[styles.settingTitle, { color: disabled ? colors.textSecondary : colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
        {description}
      </Text>
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      disabled={disabled}
      trackColor={{ false: colors.border, true: colors.primary + '80' }}
      thumbColor={value ? colors.primary : '#f4f3f4'}
    />
  </View>
);

export const NotificationSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { hasPermission, preferences, updatePreferences, requestPermission } = useNotifications();
  const [loading, setLoading] = useState(false);

  const handleMasterToggle = async (enabled: boolean) => {
    if (enabled && !hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive alerts.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
    }
    setLoading(true);
    await updatePreferences({ enabled });
    setLoading(false);
  };

  const handleTopicToggle = async (key: string, value: boolean) => {
    setLoading(true);
    await updatePreferences({ [key]: value });
    setLoading(false);
  };

  const topicsDisabled = !preferences.enabled;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, {backgroundColor: colors.surface}, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, {backgroundColor: colors.surface}]}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {!hasPermission && (
          <View style={[styles.permissionBanner, { backgroundColor: colors.warning + '20' }]}>
            <Icon name="alert-triangle" size={18} color={colors.warning} />
            <Text style={[styles.permissionText, { color: colors.warning }]}>
              Push notifications are disabled. Enable them in your device settings.
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openSettings()}
              style={[styles.permissionButton, { borderColor: colors.warning }]}
            >
              <Text style={[styles.permissionButtonText, { color: colors.warning }]}>
                Open Settings
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>GENERAL</Text>
          <SettingRow
            icon="bell"
            title="Enable Notifications"
            description="Receive push notifications from Silk Road"
            value={preferences.enabled}
            onToggle={handleMasterToggle}
            colors={colors}
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>NOTIFICATION TOPICS</Text>

          <SettingRow
            icon="package"
            title="Material Returns"
            description="Reminders when materials are due for return (3 days before)"
            value={preferences.materialReturn}
            onToggle={(v) => handleTopicToggle('materialReturn', v)}
            disabled={topicsDisabled}
            colors={colors}
          />

          <SettingRow
            icon="clock"
            title="Time Card Reminders"
            description="Clock-in and clock-out reminders for your work day"
            value={preferences.timecardReminder}
            onToggle={(v) => handleTopicToggle('timecardReminder', v)}
            disabled={topicsDisabled}
            colors={colors}
          />

          <SettingRow
            icon="briefcase"
            title="Job Assignments"
            description="Alerts when you are assigned to a new job"
            value={preferences.jobAssignment}
            onToggle={(v) => handleTopicToggle('jobAssignment', v)}
            disabled={topicsDisabled}
            colors={colors}
          />

          <SettingRow
            icon="target"
            title="Goals & Rewards"
            description="Reminders for upcoming goal deadlines"
            value={preferences.rewardGoal}
            onToggle={(v) => handleTopicToggle('rewardGoal', v)}
            disabled={topicsDisabled}
            colors={colors}
          />

          <SettingRow
            icon="star"
            title="Review Prompts"
            description="Occasional prompts to rate your experience"
            value={preferences.reviewPrompt}
            onToggle={(v) => handleTopicToggle('reviewPrompt', v)}
            disabled={topicsDisabled}
            colors={colors}
          />
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 32,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  permissionBanner: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    gap: 8,
  },
  permissionText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  permissionButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  permissionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingIcon: {
    width: 36,
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  loadingOverlay: {
    alignItems: 'center',
    paddingTop: 16,
  },
});
