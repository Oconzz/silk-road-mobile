import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/Button';
import { ScreenHeader, ConfirmationModal } from '../components/ui';
import { userService, type UserProfile } from '../services/api/domain/user';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';

type EditProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export const EditProfileScreen: React.FC<EditProfileScreenProps> = ({ navigation }) => {
  // Loading states
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Profile data
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [country, setCountry] = useState('');

  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Photo state
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setIsLoadingProfile(true);
      console.log('[EditProfileScreen] Loading profile...');
      const userProfile = await userService.getMyProfile();
      console.log('[EditProfileScreen] Profile loaded:', userProfile.id);

      setProfile(userProfile);
      setFullName(userProfile.fullName || '');
      setEmail(userProfile.email || '');
      setPhone(userProfile.phone || '');
      setCity(userProfile.city || '');
      setState(userProfile.state || '');
      setZipcode(userProfile.zipcode || '');
      setCountry(userProfile.country || '');
      setPhotoUri(userProfile.personalPhoto || null);
    } catch (error: any) {
      console.error('[EditProfileScreen] Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
      navigation.goBack();
    } finally {
      setIsLoadingProfile(false);
    }
  }, [navigation]);

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Validation
  const isValid = fullName.trim() && email.trim();
  const passwordsMatch = !showPasswordSection || (newPassword === confirmPassword && newPassword.length >= 6);
  const canSave = isValid && passwordsMatch;

  // Handle photo selection
  const handleSelectPhoto = useCallback(() => {
    Alert.alert(
      'Change Profile Photo',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: () => {
            launchCamera(
              {
                mediaType: 'photo',
                includeBase64: true,
                maxWidth: 800,
                maxHeight: 800,
                quality: 0.8,
              },
              (response) => {
                if (response.didCancel) {
                  console.log('[EditProfileScreen] Camera cancelled');
                  return;
                }
                if (response.errorCode) {
                  console.error('[EditProfileScreen] Camera error:', response.errorMessage);
                  Alert.alert('Error', 'Failed to take photo');
                  return;
                }
                if (response.assets && response.assets[0]) {
                  const asset = response.assets[0];
                  setPhotoUri(asset.uri || null);
                  setPhotoBase64(asset.base64 || null);
                  console.log('[EditProfileScreen] Photo captured');
                }
              }
            );
          },
        },
        {
          text: 'Choose from Library',
          onPress: () => {
            launchImageLibrary(
              {
                mediaType: 'photo',
                includeBase64: true,
                maxWidth: 800,
                maxHeight: 800,
                quality: 0.8,
              },
              (response) => {
                if (response.didCancel) {
                  console.log('[EditProfileScreen] Library cancelled');
                  return;
                }
                if (response.errorCode) {
                  console.error('[EditProfileScreen] Library error:', response.errorMessage);
                  Alert.alert('Error', 'Failed to select photo');
                  return;
                }
                if (response.assets && response.assets[0]) {
                  const asset = response.assets[0];
                  setPhotoUri(asset.uri || null);
                  setPhotoBase64(asset.base64 || null);
                  console.log('[EditProfileScreen] Photo selected from library');
                }
              }
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!canSave || !profile) {
      return;
    }

    // Validate password if changing
    if (showPasswordSection && newPassword) {
      if (newPassword.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters long');
        return;
      }
      if (newPassword !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }
    }

    try {
      setIsSaving(true);
      console.log('[EditProfileScreen] Saving profile...');

      const updateRequest: any = {
        id: profile.id,
        fullName: fullName.trim(),
        email: email.trim(),
      };

      // Only include optional fields if they have values
      if (phone.trim()) updateRequest.phone = phone.trim();
      if (city.trim()) updateRequest.city = city.trim();
      if (state.trim()) updateRequest.state = state.trim();
      if (zipcode.trim()) updateRequest.zipcode = zipcode.trim();
      if (country.trim()) updateRequest.country = country.trim();

      // Include password if changing
      if (showPasswordSection && newPassword) {
        updateRequest.password = newPassword;
      }

      // Include photo if changed
      if (photoBase64) {
        updateRequest.personalPhotoBase64 = photoBase64;
      }

      await userService.updateProfile(updateRequest);
      console.log('[EditProfileScreen] Profile saved successfully');

      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('[EditProfileScreen] Error saving profile:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to save profile. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  }, [canSave, profile, fullName, email, phone, city, state, zipcode, country, showPasswordSection, newPassword, confirmPassword, photoBase64]);

  // Success dismiss
  const handleSuccessDismiss = useCallback(() => {
    setShowSuccessModal(false);
    navigation.goBack();
  }, [navigation]);

  const { colors, isDark } = useTheme();

  if (isLoadingProfile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ScreenHeader
          title="Edit Profile"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScreenHeader
        title="Edit Profile"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">

          {/* Profile Photo Section */}
          <View style={styles.photoSection}>
            <TouchableOpacity
              style={styles.photoContainer}
              onPress={handleSelectPhoto}
              activeOpacity={0.7}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photo} />
              ) : (
                <View style={[styles.photoPlaceholder, {backgroundColor: colors.accent}]}>
                  <Icon name="user" size={40} color={colors.textLight} />
                </View>
              )}
              <View style={[styles.photoEditBadge, {backgroundColor: colors.accent}]}>
                <Icon name="camera" size={14} color={colors.textLight} />
              </View>
            </TouchableOpacity>
            <Text style={[styles.photoHint, {color: colors.textSecondary}]}>Tap to change photo</Text>
          </View>

          {/* Personal Info Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: colors.text}]}>Personal Information</Text>
            <View style={[styles.card, {backgroundColor: colors.surface}]}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Full Name *</Text>
                <TextInput
                  style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="John Smith"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Email *</Text>
                <TextInput
                  style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="john@example.com"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Phone</Text>
                <TextInput
                  style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>

          {/* Address Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: colors.text}]}>Address</Text>
            <View style={[styles.card, {backgroundColor: colors.surface}]}>
              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, styles.flex]}>
                  <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>City</Text>
                  <TextInput
                    style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                    value={city}
                    onChangeText={setCity}
                    placeholder="City"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={[styles.inputGroup, { width: 80 }]}>
                  <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>State</Text>
                  <TextInput
                    style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                    value={state}
                    onChangeText={setState}
                    placeholder="TX"
                    placeholderTextColor={colors.textSecondary}
                    maxLength={2}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { width: 120 }]}>
                  <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>ZIP Code</Text>
                  <TextInput
                    style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                    value={zipcode}
                    onChangeText={setZipcode}
                    placeholder="12345"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
                <View style={[styles.inputGroup, styles.flex]}>
                  <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Country</Text>
                  <TextInput
                    style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                    value={country}
                    onChangeText={setCountry}
                    placeholder="USA"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Password Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setShowPasswordSection(!showPasswordSection)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionHeaderLeft}>
                <Icon name="lock" size={18} color={colors.accent} />
                <Text style={[styles.sectionTitle, {color: colors.text}]}>Change Password</Text>
              </View>
              <Icon
                name={showPasswordSection ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {showPasswordSection && (
              <View style={[styles.card, {backgroundColor: colors.surface}]}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>New Password</Text>
                  <TextInput
                    style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Minimum 6 characters"
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Confirm Password</Text>
                  <TextInput
                    style={[styles.textInput, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm your password"
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                  {showPasswordSection && newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <Text style={[styles.errorText, {color: colors.error}]}>Passwords do not match</Text>
                  )}
                </View>
              </View>
            )}
          </View>

        </ScrollView>

        {/* Save Button */}
        <View style={[styles.bottomBar, {backgroundColor: colors.surface, borderTopColor: colors.border}]}>
          <Button
            title={isSaving ? 'Saving...' : 'Save Changes'}
            onPress={handleSave}
            loading={isSaving}
            disabled={!canSave || isSaving}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <ConfirmationModal
        visible={showSuccessModal}
        title="Profile Updated!"
        message="Your profile has been updated successfully."
        icon="check-circle"
        iconColor={colors.success}
        buttons={[
          { text: 'Continue', onPress: handleSuccessDismiss },
        ]}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,

  },

  // Photo Section
  photoSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,

  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,

    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,

    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,

  },
  photoHint: {
    marginTop: theme.spacing.sm,
    fontSize: theme.fontSize.sm,

  },

  // Section
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,

    marginBottom: theme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },

  // Card
  card: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },

  // Input
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  inputLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

    marginBottom: theme.spacing.xs,
  },
  textInput: {

    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.md,

    borderWidth: 1,

  },
  inputRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  errorText: {
    fontSize: theme.fontSize.sm,

    marginTop: theme.spacing.xs,
  },

  // Bottom Bar
  bottomBar: {
    padding: theme.spacing.md,

    borderTopWidth: 1,

  },
});
