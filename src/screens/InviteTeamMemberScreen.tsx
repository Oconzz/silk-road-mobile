import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useTeam } from '../context/TeamContext';
import { ScreenHeader } from '../components/ui';
import { CredentialsModal } from '../components/CredentialsModal';
import type { RootStackParamList } from '../types/navigation';
import { useFreemiumLimits } from '../hooks/useFreemiumLimits';

const ROLES = [
  { value: 'Crew', label: 'Crew Member', description: 'Can view assigned jobs and mark tasks complete' },
  { value: 'Leader', label: 'Team Leader', description: 'Can manage jobs and view costs (no margins)' },
  { value: 'Admin', label: 'Administrator', description: 'Full access to all features' },
];

export const InviteTeamMemberScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'InviteTeamMember'>>();
  const { inviteTeamMember, isLoading, teamMembers } = useTeam();
  const { enforceSeats } = useFreemiumLimits();

  // Get pre-populated values from route params (from contact import)
  const initialFullName = route.params?.fullName || '';
  const initialEmail = route.params?.email || '';
  const initialPhone = route.params?.phone || '';

  const [fullName, setFullName] = useState(initialFullName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [selectedRole, setSelectedRole] = useState('Crew');

  // Update fields if route params change (e.g., navigating from contact import)
  useEffect(() => {
    if (route.params?.fullName) setFullName(route.params.fullName);
    if (route.params?.email) setEmail(route.params.email);
    if (route.params?.phone) setPhone(route.params.phone);
  }, [route.params]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  // Credentials modal state
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email?: string;
    fullName?: string;
    temporaryPassword?: string;
    isNewUser?: boolean;
  }>({});

  const validateForm = useCallback(() => {
    const newErrors: { [key: string]: string } = {};
    
    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [fullName, email]);

  const handleInvite = useCallback(async () => {
    if (!validateForm()) return;

    // Check seat availability before inviting
    const canInvite = await enforceSeats(teamMembers.length, 1);
    if (!canInvite) return;
    
    const result = await inviteTeamMember({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || undefined,
      role: selectedRole,
    });

    if (result.success) {
      // Store credentials and show modal
      setCreatedCredentials({
        email: result.email,
        fullName: result.fullName,
        temporaryPassword: result.temporaryPassword,
        isNewUser: result.isNewUser,
      });
      setShowCredentialsModal(true);
    } else {
      Alert.alert('Error', result.message);
    }
  }, [validateForm, enforceSeats, teamMembers.length, inviteTeamMember, fullName, email, phone, selectedRole]);

  const handleCloseCredentialsModal = useCallback(() => {
    setShowCredentialsModal(false);
    setCreatedCredentials({});
    navigation.goBack();
  }, [navigation]);

  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      <ScreenHeader title="Invite Team Member" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info Banner */}
          <View style={[styles.infoBanner, {backgroundColor: colors.info + '15'}]}>
            <Icon name="info" size={20} color={colors.info} />
            <Text style={[styles.infoBannerText, {color: colors.info}]}>
              An email with login credentials will be sent to the invited member.
            </Text>
          </View>

          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, {color: colors.text}]}>Full Name *</Text>
            <TextInput
              style={[styles.input, {backgroundColor: colors.surface, borderColor: colors.border, color: colors.text}, errors.fullName && [styles.inputError, {borderColor: colors.error}]]}
              placeholder="Enter full name"
              placeholderTextColor={colors.textSecondary}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
            />
            {errors.fullName && (
              <Text style={[styles.errorText, {color: colors.error}]}>{errors.fullName}</Text>
            )}
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, {color: colors.text}]}>Email Address *</Text>
            <TextInput
              style={[styles.input, {backgroundColor: colors.surface, borderColor: colors.border, color: colors.text}, errors.email && [styles.inputError, {borderColor: colors.error}]]}
              placeholder="Enter email address"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            {errors.email && (
              <Text style={[styles.errorText, {color: colors.error}]}>{errors.email}</Text>
            )}
          </View>

          {/* Phone (Optional) */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, {color: colors.text}]}>Phone Number</Text>
            <TextInput
              style={[styles.input, {backgroundColor: colors.surface, borderColor: colors.border, color: colors.text}]}
              placeholder="Enter phone number"
              placeholderTextColor={colors.textSecondary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          {/* Role Selection */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, {color: colors.text}]}>Role *</Text>
            <View style={styles.roleOptions}>
              {ROLES.map(role => (
                <TouchableOpacity
                  key={role.value}
                  style={[
                    styles.roleOption,
                    {backgroundColor: colors.surface, borderColor: colors.border},
                    selectedRole === role.value && [styles.roleOptionSelected, {backgroundColor: `${colors.accent}10`}],
                  ]}
                  onPress={() => setSelectedRole(role.value)}
                >
                  <View style={styles.roleHeader}>
                    <View style={[
                      styles.radioOuter,
                      {borderColor: colors.border},
                      selectedRole === role.value && [styles.radioOuterSelected, {borderColor: colors.accent}],
                    ]}>
                      {selectedRole === role.value && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <Text style={[
                      styles.roleLabel,
                      {color: colors.text},
                      selectedRole === role.value && [styles.roleLabelSelected, {color: colors.accent}],
                    ]}>
                      {role.label}
                    </Text>
                  </View>
                  <Text style={[styles.roleDescription, {color: colors.textSecondary}]}>{role.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={[styles.footer, {borderTopColor: colors.border}]}>
          <TouchableOpacity             style={[styles.submitButton, {backgroundColor: colors.accent}, isLoading && styles.submitButtonDisabled]}
            onPress={handleInvite}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <Icon name="send" size={20} color={colors.background} />
                <Text style={[styles.submitButtonText, {color: colors.textLight}]}>Send Invitation</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Credentials Modal */}
      <CredentialsModal
        visible={showCredentialsModal}
        onClose={handleCloseCredentialsModal}
        fullName={createdCredentials.fullName}
        email={createdCredentials.email}
        temporaryPassword={createdCredentials.temporaryPassword}
        isNewUser={createdCredentials.isNewUser}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,

    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 3,

  },
  infoBannerText: {
    flex: 1,
    fontSize: theme.fontSize.sm,

    lineHeight: 20,
  },
  inputGroup: {
    gap: theme.spacing.xs,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',

    marginBottom: 4,
  },
  input: {

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.fontSize.md,

  },
  inputError: {
  },
  errorText: {
    fontSize: theme.fontSize.xs,

    marginTop: 4,
  },
  roleOptions: {
    gap: theme.spacing.sm,
  },
  roleOption: {

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    padding: theme.spacing.md,
  },
  roleOptionSelected: {
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,

    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,

  },
  roleLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',

  },
  roleLabelSelected: {
  },
  roleDescription: {
    fontSize: theme.fontSize.sm,

    marginLeft: 28,
  },
  footer: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,

  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,

    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',

  },
});
