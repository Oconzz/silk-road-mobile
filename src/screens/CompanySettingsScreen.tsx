import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
  Text,
  TextInput,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Modal,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { launchImageLibrary } from 'react-native-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Button } from '../components/Button';
import { ScreenHeader } from '../components/ui';
import { AddressAutocomplete } from '../components/AddressAutocomplete';
import { TimePicker } from '../components/TimePicker';
import { companyConfigService } from '../services/api/domain/companyConfig/companyConfigService';
import { companyService } from '../services/api/domain/company/companyService';
import type { CompanyConfig } from '../types/companyConfig';
import type { Company } from '../types/company';
import { WEEKDAYS, formatTime } from '../types/companyConfig';
import { BUSINESS_CATEGORIES } from '../types/quickStartTemplate';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import type { GeocodingResult } from '../services/geocodingService';

export const CompanySettingsScreen = () => {
  const navigation = useNavigation();
  const { updateCurrentCompanyCategory, updateCurrentCompanyLogo } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<CompanyConfig | null>(null);
  const [_company, setCompany] = useState<Company | null>(null);

  // Company Details State
  const [companyName, setCompanyName] = useState('');
  const [companyCategory, setCompanyCategory] = useState('');
  const [companyCity, setCompanyCity] = useState('');
  const [companyState, setCompanyState] = useState('');
  const [companyZip, setCompanyZip] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [fullAddress, setFullAddress] = useState('');
  const [companyLogoUri, setCompanyLogoUri] = useState<string | undefined>(undefined);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const [workDayStartHour, setWorkDayStartHour] = useState('7');
  const [workDayStartMinute, setWorkDayStartMinute] = useState('30');
  const [workDayEndHour, setWorkDayEndHour] = useState('15');
  const [workDayEndMinute, setWorkDayEndMinute] = useState('30');
  const [lunchDeductionMinutes, setLunchDeductionMinutes] = useState('60');
  const [overtimeThresholdHours, setOvertimeThresholdHours] = useState('8');
  const [weeklyOvertimeThresholdHours, setWeeklyOvertimeThresholdHours] = useState('40');
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState('5');
  const [enableClockInReminder, setEnableClockInReminder] = useState(true);
  const [enableClockOutReminder, setEnableClockOutReminder] = useState(true);
  const [requireApproval, setRequireApproval] = useState(true);
  const [selectedWorkDays, setSelectedWorkDays] = useState<string[]>(['1', '2', '3', '4', '5']);

  const loadConfig = async () => {
    try {
      setLoading(true);

      // Load config first (required)
      let configData = null;
      try {
        configData = await companyConfigService.getCompanyConfig();
        setConfig(configData);
      } catch {
        console.log('[CompanySettings] Config not found, using defaults');
        // Config might not exist yet, that's OK
      }

      // Load company data separately (can fail gracefully)
      let companyData = null;
      try {
        console.log('[CompanySettings] Calling companyService.getCompany()...');
        companyData = await companyService.getCompany();
        console.log('[CompanySettings] Company data received:', companyData);
        setCompany(companyData);
        // Set company form data
        setCompanyName(companyData?.name || '');
        setCompanyCategory(companyData?.category || '');
        setCompanyCity(companyData?.city || '');
        setCompanyState(companyData?.state || '');
        setCompanyZip(companyData?.zipcode || '');
        setCompanyLogoUri(companyData?.logo || companyData?.logoThumbnail || undefined);
        if (companyData?.city && companyData?.state) {
          setFullAddress(`${companyData.city}, ${companyData.state} ${companyData.zipcode || ''}`.trim());
        }
      } catch (companyError: any) {
        console.error('[CompanySettings] Company load error:', companyError);
        // Company data failed but we can still show settings
      }

      // Set config data if available
      if (configData) {
        setWorkDayStartHour(String(configData.workDayStartHour));
        setWorkDayStartMinute(String(configData.workDayStartMinute));
        setWorkDayEndHour(String(configData.workDayEndHour));
        setWorkDayEndMinute(String(configData.workDayEndMinute));
        setLunchDeductionMinutes(String(configData.lunchDeductionMinutes || 30));
        setOvertimeThresholdHours(String(configData.overtimeThresholdHours || 8));
        setWeeklyOvertimeThresholdHours(String(configData.weeklyOvertimeThresholdHours || 40));
        setReminderMinutesBefore(String(configData.reminderMinutesBefore || 5));
        setEnableClockInReminder(configData.enableClockInReminder ?? true);
        setEnableClockOutReminder(configData.enableClockOutReminder ?? true);
        setRequireApproval(configData.requireApproval ?? true);

        // Parse workDays - pode vir como números ou nomes
        const workDaysArray = configData.workDays?.split(',').map((d: string) => d.trim()) || [];
        const workDayNumbers = workDaysArray.map((day: string) => {
          const dayNum = parseInt(day, 10);
          if (!isNaN(dayNum)) return String(dayNum);
          // Se for nome, converter para número
          const weekday = WEEKDAYS.find(w => w.label === day);
          return weekday ? weekday.value : null;
        }).filter(Boolean) as string[];

        setSelectedWorkDays(workDayNumbers.length > 0 ? workDayNumbers : ['1', '2', '3', '4', '5']);
      }
    } catch (error: any) {
      console.error('[CompanySettings] Load error:', error);
      Alert.alert('Error', 'Failed to load company settings');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadConfig();
    }, [])
  );

  const toggleWorkDay = (day: string) => {
    setSelectedWorkDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const startHour = parseInt(workDayStartHour, 10);
      const startMinute = parseInt(workDayStartMinute, 10);
      const endHour = parseInt(workDayEndHour, 10);
      const endMinute = parseInt(workDayEndMinute, 10);

      if (
        isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute) ||
        startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23 ||
        startMinute < 0 || startMinute > 59 || endMinute < 0 || endMinute > 59
      ) {
        Alert.alert('Invalid Input', 'Please enter valid hours (0-23) and minutes (0-59)');
        return;
      }

      // Save company details
      if (companyName.trim()) {
        await companyService.updateCompany({
          name: companyName,
          category: companyCategory,
          city: companyCity,
          state: companyState,
          zipcode: companyZip,
          logoUrl: companyLogoUri,
        });
        // Update the category in AuthContext so QuickStart templates reload
        if (companyCategory) {
          updateCurrentCompanyCategory(companyCategory);
        }
        // Update the logo in AuthContext so SettingsScreen shows it
        updateCurrentCompanyLogo(companyLogoUri);
      }

      const request = {
        workDayStartHour: startHour,
        workDayStartMinute: startMinute,
        workDayEndHour: endHour,
        workDayEndMinute: endMinute,
        breakDeductionMinutes: parseInt(lunchDeductionMinutes, 10) || 30,
        overtimeThresholdHours: parseFloat(overtimeThresholdHours) || 8,
        weeklyOvertimeThresholdHours: parseFloat(weeklyOvertimeThresholdHours) || 40,
        reminderMinutesBefore: parseInt(reminderMinutesBefore, 10) || 5,
        enableClockInReminder,
        enableClockOutReminder,
        requireApproval,
        workDaysOfWeek: selectedWorkDays.map(d => WEEKDAYS[parseInt(d, 10)].label).join(','),
      };

      if (config) {
        await companyConfigService.updateCompanyConfig(request);
      } else {
        await companyConfigService.createCompanyConfig(request as any);
      }

      Alert.alert('Success', 'Company settings saved successfully');
      await loadConfig();
    } catch {
      Alert.alert('Error', 'Failed to save company settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectLogo = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.6,
        maxWidth: 256,
        maxHeight: 256,
        includeBase64: true,
      });
      if (result.didCancel || result.errorCode) return;
      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          setUploadingLogo(true);
          const base64Image = `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`;
          setCompanyLogoUri(base64Image);
          setUploadingLogo(false);
        }
      }
    } catch {
      Alert.alert('Error', 'Could not process image');
    }
  };

  const handleRemoveLogo = () => {
    setCompanyLogoUri(undefined);
  };

  const handleAddressSelect = (address: GeocodingResult) => {
    setCompanyCity(address.city);
    setCompanyState(address.state);
    setCompanyZip(address.zipcode);
    setFullAddress(address.formattedAddress);
  };

  // Refresh company data when screen comes into focus (after location selection)
  useFocusEffect(
    useCallback(() => {
      const refreshCompanyData = async () => {
        try {
          const companyData = await companyService.getCompany();
          if (companyData) {
            setCompany(companyData);
            setCompanyName(companyData?.name || '');
            setCompanyCategory(companyData?.category || '');
            setCompanyCity(companyData?.city || '');
            setCompanyState(companyData?.state || '');
            setCompanyZip(companyData?.zipcode || '');
            // Update fullAddress when returning from location selection
            if (companyData?.city && companyData?.state) {
              setFullAddress(`${companyData.city}, ${companyData.state} ${companyData.zipcode || ''}`.trim());
            }
          }
        } catch (error) {
          console.log('[CompanySettings] Error refreshing company data:', error);
        }
      };

      refreshCompanyData();
    }, [])
  );

  const { colors, isDark } = useTheme();

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ScreenHeader title="Company Settings" onBack={() => navigation.goBack()} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScreenHeader title="Company Settings" onBack={() => navigation.goBack()} />
      <ScrollView style={[styles.scrollView, {backgroundColor: colors.background}]} contentContainerStyle={styles.content}>
        {/* Company Details Section */}
        <View style={[styles.sectionCard, {backgroundColor: colors.surface}]}>
          <View style={styles.sectionTitleRow}>
            <Icon name="briefcase" size={20} color={colors.accent} />
            <Text style={[styles.sectionTitle, {color: colors.text}]}>Company Details</Text>
          </View>

          {/* Company Logo */}
          <Text style={[styles.label, {color: colors.textSecondary}]}>Company Logo</Text>
          {companyLogoUri ? (
            <View style={styles.logoPreviewContainer}>
              <Image
                source={{ uri: companyLogoUri }}
                style={[styles.logoPreview, { borderColor: colors.border }]}
                resizeMode="contain"
              />
              <TouchableOpacity
                style={[styles.logoRemoveBtn, { backgroundColor: colors.error }]}
                onPress={handleRemoveLogo}
              >
                <Icon name="x" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.logoUploadBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={handleSelectLogo}
              disabled={uploadingLogo}
              activeOpacity={0.7}
            >
              {uploadingLogo ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <>
                  <Icon name="upload" size={24} color={colors.accent} />
                  <Text style={[styles.logoUploadText, { color: colors.text }]}>Add Logo</Text>
                  <Text style={[styles.logoUploadHint, { color: colors.textSecondary }]}>PNG, JPG up to 5MB</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <Text style={[styles.label, {color: colors.textSecondary}]}>Company Name</Text>
          <TextInput
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="Enter company name"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
          />

          <Text style={[styles.label, {color: colors.textSecondary}]}>Business Category</Text>
          <TouchableOpacity
            style={[styles.dropdownInput, {borderColor: colors.border}]}
            onPress={() => setShowCategoryModal(true)}
            activeOpacity={0.7}>
            <View style={styles.dropdownContent}>
              <Icon
                name="tag"
                size={18}
                color={companyCategory ? colors.accent : colors.textSecondary}
              />
              <Text style={[
                styles.dropdownText,
                { color: companyCategory ? colors.text : colors.textSecondary }
              ]}>
                {companyCategory || 'Select Category'}
              </Text>
            </View>
            <Icon name="chevron-down" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <Text style={[styles.label, {color: colors.textSecondary}]}>Location</Text>
          
          <AddressAutocomplete
            value={fullAddress}
            onChangeText={setFullAddress}
            onSelectAddress={handleAddressSelect}
            placeholder="Search for company address"
            label="Address Search"
          />

          <View style={styles.row}>
            <View style={{ flex: 2 }}>
              <Text style={[styles.subLabel, {color: colors.textSecondary}]}>City</Text>
              <TextInput
                value={companyCity}
                onChangeText={setCompanyCity}
                placeholder="City"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.subLabel, {color: colors.textSecondary}]}>State</Text>
              <TextInput
                value={companyState}
                onChangeText={setCompanyState}
                placeholder="ST"
                placeholderTextColor={colors.textSecondary}
                maxLength={2}
                autoCapitalize="characters"
                style={[styles.input, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
              />
            </View>
          </View>

          <Text style={[styles.subLabel, {color: colors.textSecondary}]}>ZIP Code</Text>
          <TextInput
            value={companyZip}
            onChangeText={setCompanyZip}
            placeholder="ZIP Code"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
            maxLength={5}
            style={[styles.input, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
          />
        </View>

        {/* Category Selection Modal */}
        <Modal
          visible={showCategoryModal}
          transparent={true}
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setShowCategoryModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={styles.modalBackdrop} 
              activeOpacity={1} 
              onPress={() => setShowCategoryModal(false)}
            />
            <View style={[styles.modalContent, {backgroundColor: colors.surface}]}>
              <Text style={[styles.modalTitle, {color: colors.text}]}>Select Business Category</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {BUSINESS_CATEGORIES.map(cat => (
                  <TouchableOpacity                     key={cat}
                    style={[styles.modalItem, {backgroundColor: colors.surface}, {borderBottomColor: colors.border}]}
                    onPress={() => {
                      setCompanyCategory(cat);
                      setShowCategoryModal(false);
                    }}>
                    <Text style={[
                      styles.modalItemText,
                      {color: colors.text},
                      companyCategory === cat && { color: colors.accent, fontWeight: 'bold' }
                    ]}>
                      {cat}
                    </Text>
                    {companyCategory === cat && (
                      <Icon name="check" size={18} color={colors.accent} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setShowCategoryModal(false)}
                style={{ marginTop: 10 }}
              />
            </View>
          </View>
        </Modal>

        {/* Work Hours Section */}
        <View style={[styles.sectionCard, {backgroundColor: colors.surface}]}>
          <View style={styles.sectionTitleRow}>
            <Icon name="clock" size={20} color={colors.accent} />
            <Text style={[styles.sectionTitle, {color: colors.text}]}>Work Hours</Text>
          </View>
          <Text style={[styles.sectionHint, {color: colors.textSecondary}]}>Set your standard work schedule</Text>
  
          <View style={styles.timeCardsRow}>
          {/* Start Time Card */}
            <TouchableOpacity style={[styles.timeCard, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => setShowStartTimePicker(true)} activeOpacity={0.7}>
              <Text style={[styles.timeCardLabel, {color: colors.textSecondary}]}>Start Time</Text>
              <Text style={[styles.timeDisplay, {color: colors.text}]}>
                {formatTime(parseInt(workDayStartHour) || 0, parseInt(workDayStartMinute) || 0)}
              </Text>
            </TouchableOpacity>

          {/* Arrow Icon */}
          <View style={styles.timeArrow}>
            <Icon name="arrow-right" size={20} color={colors.textSecondary} />
          </View>

          {/* End Time Card */}
          <TouchableOpacity style={[styles.timeCard, {backgroundColor: colors.background, borderColor: colors.border}]} onPress={() => setShowEndTimePicker(true)} activeOpacity={0.7}>
            <Text style={[styles.timeCardLabel, {color: colors.textSecondary}]}>End Time</Text>
            <Text style={[styles.timeDisplay, {color: colors.text}]}>
              {formatTime(parseInt(workDayEndHour) || 0, parseInt(workDayEndMinute) || 0)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Time Pickers */}
      <TimePicker
        visible={showStartTimePicker}
        hour={parseInt(workDayStartHour) || 0}
        minute={parseInt(workDayStartMinute) || 0}
        onHourChange={(h) => setWorkDayStartHour(String(h))}
        onMinuteChange={(m) => setWorkDayStartMinute(String(m))}
        onClose={() => setShowStartTimePicker(false)}
        title="Start Time"
      />
      <TimePicker
        visible={showEndTimePicker}
        hour={parseInt(workDayEndHour) || 0}
        minute={parseInt(workDayEndMinute) || 0}
        onHourChange={(h) => setWorkDayEndHour(String(h))}
        onMinuteChange={(m) => setWorkDayEndMinute(String(m))}
        onClose={() => setShowEndTimePicker(false)}
        title="End Time"
      />

      {/* Work Days Section */}
      <View style={[styles.sectionCard, {backgroundColor: colors.surface}]}>
        <View style={styles.sectionTitleRow}>
          <Icon name="calendar" size={20} color={colors.accent} />
          <Text style={[styles.sectionTitle, {color: colors.text}]}>Work Days</Text>
        </View>
        <Text style={[styles.sectionHint, {color: colors.textSecondary}]}>Select the days your team typically works</Text>
        <View style={styles.workDaysGrid}>
          {WEEKDAYS.map(day => {
            const isSelected = selectedWorkDays.includes(day.value);
            return (
              <TouchableOpacity                 key={day.value}
                style={[styles.dayPill, {backgroundColor: colors.surface}, isSelected && [styles.dayPillSelected, {backgroundColor: colors.accent}]]}
                onPress={() => toggleWorkDay(day.value)}
                activeOpacity={0.7}
              >
                {isSelected && (
                  <Icon name="check" size={14} color={colors.textLight} style={styles.dayCheckIcon} />
                )}
                <Text style={[styles.dayPillText, {color: colors.text}, isSelected && [styles.dayPillTextSelected, {color: colors.textLight}]]}>
                  {day.label.substring(0, 3)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Lunch & Breaks Section */}
      <View style={[styles.sectionCard, {backgroundColor: colors.surface}]}>
        <View style={styles.sectionTitleRow}>
          <Icon name="coffee" size={20} color={colors.accent} />
          <Text style={[styles.sectionTitle, {color: colors.text}]}>Lunch & Breaks</Text>
        </View>
        <Text style={[styles.label, {color: colors.textSecondary}]}>Lunch Deduction (minutes)</Text>
        <TextInput
          value={lunchDeductionMinutes}
          onChangeText={setLunchDeductionMinutes}
          placeholder="60"
          placeholderTextColor={colors.textSecondary}
          keyboardType="numeric"
          style={[styles.input, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
        />
      </View>

      {/* Overtime Settings Section */}
      <View style={[styles.sectionCard, {backgroundColor: colors.surface}]}>
        <View style={styles.sectionTitleRow}>
          <Icon name="trending-up" size={20} color={colors.accent} />
          <Text style={[styles.sectionTitle, {color: colors.text}]}>Overtime Settings</Text>
        </View>
        <Text style={[styles.label, {color: colors.textSecondary}]}>Daily Overtime Threshold (hours)</Text>
        <TextInput
          value={overtimeThresholdHours}
          onChangeText={setOvertimeThresholdHours}
          placeholder="8"
          placeholderTextColor={colors.textSecondary}
          keyboardType="numeric"
          style={[styles.input, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
        />

        <Text style={[styles.label, {color: colors.textSecondary}]}>Weekly Overtime Threshold (hours)</Text>
        <TextInput
          value={weeklyOvertimeThresholdHours}
          onChangeText={setWeeklyOvertimeThresholdHours}
          placeholder="40"
          placeholderTextColor={colors.textSecondary}
          keyboardType="numeric"
          style={[styles.input, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
        />
      </View>

      {/* Reminders Section */}
      <View style={[styles.sectionCard, {backgroundColor: colors.surface}]}>
        <View style={styles.sectionTitleRow}>
          <Icon name="bell" size={20} color={colors.accent} />
          <Text style={[styles.sectionTitle, {color: colors.text}]}>Reminders</Text>
        </View>
        <View style={[styles.switchRow, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Text style={[styles.label, {color: colors.textSecondary, marginBottom: 0}]}>Enable Clock-In Reminders</Text>
          <Switch value={enableClockInReminder} onValueChange={setEnableClockInReminder} />
        </View>

        <View style={[styles.switchRow, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Text style={[styles.label, {color: colors.textSecondary, marginBottom: 0}]}>Enable Clock-Out Reminders</Text>
          <Switch value={enableClockOutReminder} onValueChange={setEnableClockOutReminder} />
        </View>

        <Text style={[styles.label, {color: colors.textSecondary}]}>Reminder Minutes Before</Text>
        <TextInput
          value={reminderMinutesBefore}
          onChangeText={setReminderMinutesBefore}
          placeholder="5"
          placeholderTextColor={colors.textSecondary}
          keyboardType="numeric"
          style={[styles.input, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
        />
      </View>

      {/* Approval Settings Section */}
      <View style={[styles.sectionCard, {backgroundColor: colors.surface}]}>
        <View style={styles.sectionTitleRow}>
          <Icon name="check-circle" size={20} color={colors.accent} />
          <Text style={[styles.sectionTitle, {color: colors.text}]}>Approval Settings</Text>
        </View>
        <View style={[styles.switchRow, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Text style={[styles.label, {color: colors.textSecondary, marginBottom: 0}]}>Require Time Card Approval</Text>
          <Switch value={requireApproval} onValueChange={setRequireApproval} />
        </View>
      </View>

      <Button
        title="Save Settings"
        variant="primary"
        onPress={handleSave}
        loading={saving}
        style={styles.saveButton}
      />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Section Card
  sectionCard: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadow.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,

  },
  sectionHint: {
    fontSize: theme.fontSize.sm,

    marginBottom: theme.spacing.md,
  },
  
  // Time Cards
  timeCardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeCard: {
    flex: 1,

    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  timeCardLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

    marginBottom: theme.spacing.sm,
  },
  timeArrow: {
    paddingHorizontal: theme.spacing.sm,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeInput: {
    borderWidth: 1,

    borderRadius: 8,
    padding: 10,
    fontSize: 18,
    fontWeight: '600',
    width: 50,
    textAlign: 'center',

  },
  timeSeparator: {
    fontSize: 20,
    fontWeight: 'bold',

  },
  timeDisplay: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,

  },
  timePreview: {
    fontSize: theme.fontSize.xs,

    marginTop: theme.spacing.xs,
    fontWeight: theme.fontWeight.medium,
  },
  
  // Work Days Grid
  workDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  dayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,

    borderWidth: 1,

  },
  dayPillSelected: {
  },
  dayPillText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

  },
  dayPillTextSelected: {
  },
  dayCheckIcon: {
    marginRight: 4,
  },
  
  // Legacy styles
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,

  },
  input: {
    borderWidth: 1,

    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,

  },
  dropdownInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,

    borderRadius: 8,
    padding: 12,
    marginBottom: 16,

  },
  dropdownContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dropdownText: {
    fontSize: 16,
  },
  preview: {
    fontSize: 12,

    marginTop: 4,
    fontWeight: '500',
  },
  workDaysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    minWidth: 45,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,

    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,

  },
  saveButton: {
    marginTop: 32,
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {

    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,

  },
  modalItemText: {
    fontSize: 16,

    flex: 1,
  },
  subLabel: {
    fontSize: 12,

    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  divider: {
    height: 1,

    marginVertical: 20,
  },

  // Company Logo
  logoPreviewContainer: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 16,
  },
  logoPreview: {
    width: 120,
    height: 120,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
  },
  logoRemoveBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  logoUploadBtn: {
    height: 120,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoUploadText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    marginTop: theme.spacing.xs,
  },
  logoUploadHint: {
    fontSize: theme.fontSize.xs,
    marginTop: 2,
  },
});
