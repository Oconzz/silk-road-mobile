import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Image,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {useAuth} from '../context/AuthContext';
import {useTheme} from '../context/ThemeContext';
import {useTeam} from '../context/TeamContext';
import {useFreemiumLimits} from '../hooks/useFreemiumLimits';
import {theme} from '../theme';
import { googleCalendarService } from '../services/api/domain/googleCalendar';
import { squarePaymentService } from '../services/api/domain/squarePayment';
import { userService, type UserProfile } from '../services/api/domain/user';
import { inAppReviewService } from '../services/inAppReviewService';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types/navigation';

// Configure Google Sign-In once at module level
// Note: Replace with your actual Client IDs from Google Cloud Console
GoogleSignin.configure({
  webClientId: '711956571676-3esdtgopg8qdmu89c0prc6gpd8cus93c.apps.googleusercontent.com', // Web Client ID (for backend token exchange)
  iosClientId: '711956571676-dehm18m4p1kbjp19qm5959e512sv434v.apps.googleusercontent.com', // iOS Client ID
  offlineAccess: true,
  scopes: ['https://www.googleapis.com/auth/calendar.events'],
});

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
};

interface SettingsItemProps {
  icon: string;
  label: string;
  onPress: () => void;
  showChevron?: boolean;
  destructive?: boolean;
  rightValue?: string;
  rightValueColor?: string;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  icon,
  label,
  onPress,
  showChevron = true,
  destructive = false,
  rightValue,
  rightValueColor,
}) => {
  const {colors} = useTheme();
  return (
    <TouchableOpacity style={[styles.settingsItem, {borderBottomColor: colors.border}]} onPress={onPress}>
      <View style={styles.settingsItemLeft}>
        <Icon
          name={icon}
          size={20}
          color={destructive ? colors.error : colors.text}
        />
        <Text
          style={[
            styles.settingsItemLabel,
            {color: colors.text},
            destructive && [styles.settingsItemLabelDestructive, {color: colors.error}],
          ]}>
          {label}
        </Text>
      </View>
      <View style={styles.settingsItemRight}>
        {rightValue && (
          <View style={[styles.settingsItemBadge, { backgroundColor: `${rightValueColor || colors.accent}15` }]}>
            <Text style={[styles.settingsItemBadgeText, { color: rightValueColor || colors.accent }]}>
              {rightValue}
            </Text>
          </View>
        )}
        {showChevron && (
          <Icon name="chevron-right" size={20} color={colors.textSecondary} />
        )}
      </View>
    </TouchableOpacity>
  );
};

export const SettingsScreen: React.FC<SettingsScreenProps> = ({navigation}) => {
  const {user, currentCompany, logout} = useAuth();
  const { isDark, toggleTheme, colors } = useTheme();
  const { teamMembers, loadTeamMembers } = useTeam();
  const { isSubscribed, seatInfo, checkSeats } = useFreemiumLimits();

  // Load team members for seat counter
  useFocusEffect(
    useCallback(() => {
      loadTeamMembers();
    }, [loadTeamMembers])
  );

  // User profile state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Google Calendar state (NMJ-42)
  const [calendarLinked, setCalendarLinked] = useState(false);
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [isCheckingCalendarStatus, setIsCheckingCalendarStatus] = useState(true);

  // Square Payment state
  const [squareLinked, setSquareLinked] = useState(false);
  const [squareMerchantId, setSquareMerchantId] = useState<string | null>(null);
  const [isLoadingSquare, setIsLoadingSquare] = useState(false);
  const [isCheckingSquareStatus, setIsCheckingSquareStatus] = useState(true);

  // Check Google Calendar connection status on mount
  const checkCalendarStatus = useCallback(async () => {
    try {
      setIsCheckingCalendarStatus(true);
      const status = await googleCalendarService.getStatus();
      setCalendarLinked(status.isLinked);
      setCalendarEmail(status.linkedEmail || null);
    } catch {
      // Silently handle errors - endpoint may not be deployed yet
      // Default to "not linked" state which allows users to try connecting
      console.log('[Settings] Calendar status check failed (endpoint may not be available yet)');
      setCalendarLinked(false);
      setCalendarEmail(null);
    } finally {
      setIsCheckingCalendarStatus(false);
    }
  }, []);

  // Check Square connection status on mount
  const checkSquareStatus = useCallback(async () => {
    try {
      setIsCheckingSquareStatus(true);
      const status = await squarePaymentService.getStatus();
      setSquareLinked(status.isLinked);
      setSquareMerchantId(status.merchantId || null);
    } catch {
      console.log('[Settings] Square status check failed (endpoint may not be available yet)');
      setSquareLinked(false);
      setSquareMerchantId(null);
    } finally {
      setIsCheckingSquareStatus(false);
    }
  }, []);

  // Load user profile
  const loadUserProfile = useCallback(async () => {
    try {
      console.log('[Settings] Loading user profile...');
      const profile = await userService.getMyProfile();
      setUserProfile(profile);
      console.log('[Settings] User profile loaded:', profile.fullName);
    } catch (error) {
      console.log('[Settings] Failed to load user profile:', error);
    }
  }, []);

  // Load data when screen is focused (to refresh after editing profile)
  useFocusEffect(
    useCallback(() => {
      checkCalendarStatus();
      checkSquareStatus();
      loadUserProfile();
    }, [checkCalendarStatus, checkSquareStatus, loadUserProfile])
  );

  // Handle Google Calendar link/unlink (NMJ-42)
  const handleGoogleCalendar = async () => {
    if (calendarLinked) {
      // Disconnect flow
      Alert.alert(
        'Disconnect Google Calendar',
        `Are you sure you want to disconnect ${calendarEmail || 'your Google Calendar'}? Future jobs will no longer be synced to your calendar.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: async () => {
              try {
                setIsLoadingCalendar(true);
                await googleCalendarService.disconnect();
                setCalendarLinked(false);
                setCalendarEmail(null);
                Alert.alert('Success', 'Google Calendar disconnected successfully.');
              } catch (error) {
                console.error('[Settings] Error disconnecting calendar:', error);
                Alert.alert('Error', 'Failed to disconnect Google Calendar. Please try again.');
              } finally {
                setIsLoadingCalendar(false);
              }
            },
          },
        ]
      );
    } else {
      // Connect flow using Google Sign-In
      try {
        setIsLoadingCalendar(true);

        // Check if Play Services are available (Android)
        await GoogleSignin.hasPlayServices();

        // Sign in with Google (v16.x API)
        const userInfo = await GoogleSignin.signIn();
        // In v16.x, serverAuthCode is in data.serverAuthCode
        const serverAuthCode = (userInfo as any).data?.serverAuthCode || (userInfo as any).serverAuthCode;

        if (!serverAuthCode) {
          throw new Error('Failed to get authorization code from Google. Make sure offlineAccess is enabled.');
        }

        // Exchange code with backend
        const result = await googleCalendarService.exchangeCode(serverAuthCode);

        if (result.success) {
          setCalendarLinked(true);
          setCalendarEmail(result.linkedEmail || null);

          // Build success message with synced jobs count
          let successMessage = `Google Calendar connected to ${result.linkedEmail || 'your account'}!`;
          if (result.syncedJobsCount && result.syncedJobsCount > 0) {
            successMessage += `\n\n${result.syncedJobsCount} existing job${result.syncedJobsCount > 1 ? 's were' : ' was'} synced to your calendar.`;
          }
          successMessage += '\n\nFuture jobs will automatically sync to your calendar.';

          Alert.alert('Calendar Connected', successMessage);
        } else {
          throw new Error('Failed to link calendar');
        }
      } catch (error: any) {
        console.error('[Settings] Error linking calendar:', error);

        // Handle specific Google Sign-In errors
        if (error.code === 'SIGN_IN_CANCELLED') {
          // User cancelled, no need to show error
          return;
        }

        Alert.alert(
          'Error',
          error.message || 'Failed to connect Google Calendar. Please try again.'
        );
      } finally {
        setIsLoadingCalendar(false);
      }
    }
  };

  // Handle Square link/unlink
  const handleSquarePayment = async () => {
    if (squareLinked) {
      // Disconnect flow
      Alert.alert(
        'Disconnect Square',
        `Are you sure you want to disconnect your Square account? You won't be able to collect payments through the app.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disconnect',
            style: 'destructive',
            onPress: async () => {
              try {
                setIsLoadingSquare(true);
                await squarePaymentService.disconnect();
                setSquareLinked(false);
                setSquareMerchantId(null);
                Alert.alert('Success', 'Square disconnected successfully.');
              } catch (error) {
                console.error('[Settings] Error disconnecting Square:', error);
                Alert.alert('Error', 'Failed to disconnect Square. Please try again.');
              } finally {
                setIsLoadingSquare(false);
              }
            },
          },
        ]
      );
    } else {
      // Connect flow - show options for OAuth or Sandbox token
      Alert.alert(
        'Connect Square',
        'Choose how to connect your Square account:',
        [
          {
            text: 'OAuth (Production)',
            onPress: async () => {
              try {
                setIsLoadingSquare(true);
                const { authorizationUrl } = await squarePaymentService.getAuthUrl();
                const canOpen = await Linking.canOpenURL(authorizationUrl);
                if (canOpen) {
                  await Linking.openURL(authorizationUrl);
                  Alert.alert(
                    'Complete Authorization',
                    'Complete the Square authorization in your browser. Once done, return to this app and pull down to refresh.',
                    [{ text: 'OK', onPress: checkSquareStatus }]
                  );
                } else {
                  Alert.alert('Error', 'Unable to open authorization URL.');
                }
              } catch (error: any) {
                console.error('[Settings] Error getting Square auth URL:', error);
                Alert.alert('Error', error.message || 'Failed to connect Square.');
              } finally {
                setIsLoadingSquare(false);
              }
            },
          },
          {
            text: 'Sandbox Token',
            onPress: () => {
              Alert.prompt(
                'Enter Sandbox Token',
                'Paste your Square Sandbox access token from the Developer Console:',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Link',
                    onPress: async (token: string | undefined) => {
                      if (!token?.trim()) {
                        Alert.alert('Error', 'Please enter a valid token.');
                        return;
                      }
                      try {
                        setIsLoadingSquare(true);
                        const result = await squarePaymentService.linkSandboxToken(token.trim());
                        if (result.success) {
                          setSquareLinked(true);
                          setSquareMerchantId(result.merchantId || null);
                          Alert.alert('Success', 'Square sandbox account linked successfully!');
                        } else {
                          Alert.alert('Error', 'Failed to link sandbox token.');
                        }
                      } catch (error: any) {
                        console.error('[Settings] Error linking sandbox token:', error);
                        Alert.alert('Error', error.message || 'Failed to link sandbox token.');
                      } finally {
                        setIsLoadingSquare(false);
                      }
                    },
                  },
                ],
                'plain-text',
                'EAAAlw6rtlUxA8zW4xIIJms_W8ccIH3pJAQkMceuFWv9y9-DlUxp6Eu7Kk544rfS'
              );
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              console.error('Logout error:', error);
            }
          },
        },
      ]
    );
  };

  const isAdmin = currentCompany?.role === 'Admin' || currentCompany?.role === 'SuperAdmin';

  const handleTeamManagement = () => {
    if (isAdmin) {
      navigation.navigate('TeamMembers');
    } else {
      Alert.alert('Access Denied', 'Only administrators can access team management.');
    }
  };

  const handleCompanySettings = () => {
    if (isAdmin) {
      navigation.navigate('CompanySettings');
    } else {
      Alert.alert('Access Denied', 'Only administrators can access company settings.');
    }
  };

  const handleNotifications = () => {
    navigation.navigate('NotificationSettings');
  };

  const handleLeaveReview = async () => {
    const isAvailable = inAppReviewService.isAvailable();
    if (isAvailable) {
      const success = await inAppReviewService.requestReview();
      if (!success) {
        openAppStoreFallback();
      }
    } else {
      openAppStoreFallback();
    }
  };

  const openAppStoreFallback = () => {
    // TODO: Replace with actual App Store ID when published
    const APP_STORE_ID = 'YOUR_APP_STORE_ID';
    const storeUrl = Platform.OS === 'ios'
      ? `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`
      : `https://play.google.com/store/apps/details?id=com.silkroad.app`;
    Linking.openURL(storeUrl).catch(() => {
      Alert.alert('Review', 'Unable to open the store page. The app may not be published yet.');
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.surface}, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        {/* Dark Mode Toggle */}
        <TouchableOpacity style={[styles.themeToggle, { backgroundColor: `${colors.accent}10` }]} onPress={toggleTheme} activeOpacity={0.7}>
          <Icon name={isDark ? 'sun' : 'moon'} size={20} color={isDark ? colors.warning : colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView style={[styles.content, { backgroundColor: colors.surface }]}>
        {/* Profile Section */}
        <View style={[styles.profileSection, {backgroundColor: colors.surface}, { borderBottomColor: colors.divider }]}>
          <View style={styles.avatarRow}>
            {/* Company Logo (left) */}
            {currentCompany?.companyLogo || currentCompany?.companyLogoThumbnail ? (
              <View style={[styles.companyLogoContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Image
                  source={{ uri: currentCompany.companyLogoThumbnail || currentCompany.companyLogo }}
                  style={styles.companyLogo}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {/* User Profile Avatar */}
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={() => navigation.navigate('EditProfile')}
              activeOpacity={0.7}
            >
              {userProfile?.personalPhoto || userProfile?.personalPhotoThumbnail ? (
                <Image
                  source={{ uri: userProfile.personalPhotoThumbnail || userProfile.personalPhoto }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.accent }]}>
                  <Icon name="user" size={32} color={colors.textLight} />
                </View>
              )}
              <View style={[styles.avatarEditBadge, { backgroundColor: colors.accent, borderColor: colors.background }]}>
                <Icon name="edit-2" size={12} color={colors.textLight} />
              </View>
            </TouchableOpacity>
          </View>
          <Text style={[styles.userName, { color: colors.text }]}>{userProfile?.fullName || user?.email?.split('@')[0] || 'User'}</Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email || ''}</Text>
          {currentCompany && (
            <View style={[styles.companyBadge, { backgroundColor: `${colors.accent}10` }]}>
              <Icon name="briefcase" size={14} color={colors.accent} />
              <Text style={[styles.companyName, { color: colors.accent }]}>{currentCompany.companyName}</Text>
              <Text style={[styles.companyRole, { color: colors.textSecondary }]}>• {currentCompany.role}</Text>
            </View>
          )}
        </View>

        {/* Account Section */}
        <View style={[styles.section, {backgroundColor: colors.surface}]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Account</Text>
          <View style={[styles.sectionContent, { backgroundColor: colors.surface }]}>
            <SettingsItem
              icon="user"
              label="Account Settings"
              onPress={() => navigation.navigate('EditProfile')}
            />
          </View>
        </View>

        {/* Integrations Section (NMJ-42) */}
        <View style={[styles.section, {backgroundColor: colors.surface}]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Integrations</Text>
          <View style={[styles.sectionContent, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={[styles.settingsItem, {borderBottomColor: colors.border}]}
              onPress={handleGoogleCalendar}
              disabled={isLoadingCalendar || isCheckingCalendarStatus}
            >
              <View style={styles.settingsItemLeft}>
                <Icon
                  name="calendar"
                  size={20}
                  color={calendarLinked ? colors.success : colors.text}
                />
                <View style={styles.calendarItemText}>
                  <Text style={[styles.settingsItemLabel, { color: colors.text, marginLeft: 0 }]}>
                    {isCheckingCalendarStatus
                      ? 'Checking...'
                      : calendarLinked
                        ? 'Google Calendar Connected'
                        : 'Connect Google Calendar'}
                  </Text>
                  {calendarLinked && calendarEmail && (
                    <Text style={[styles.calendarEmailText, { color: colors.textSecondary }]}>{calendarEmail}</Text>
                  )}
                </View>
              </View>
              {isLoadingCalendar || isCheckingCalendarStatus ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : calendarLinked ? (
                <View style={[styles.connectedBadge, {backgroundColor: `${colors.success}15`}]}>
                  <Icon name="check-circle" size={16} color={colors.success} />
                </View>
              ) : (
                <Icon name="chevron-right" size={20} color={colors.textSecondary} />
              )}
            </TouchableOpacity>

            {/* Square Payment Integration */}
            <TouchableOpacity
              style={[styles.settingsItem, {borderBottomColor: colors.border}]}
              onPress={handleSquarePayment}
              disabled={isLoadingSquare || isCheckingSquareStatus}
            >
              <View style={styles.settingsItemLeft}>
                <Icon
                  name="credit-card"
                  size={20}
                  color={squareLinked ? colors.success : colors.text}
                />
                <View style={styles.calendarItemText}>
                  <Text style={[styles.settingsItemLabel, {color: colors.text, marginLeft: 0}]}>
                    {isCheckingSquareStatus
                      ? 'Checking...'
                      : squareLinked
                        ? 'Square Payments Connected'
                        : 'Connect Square Payments'}
                  </Text>
                  {squareLinked && squareMerchantId && (
                    <Text style={[styles.calendarEmailText, {color: colors.textSecondary}]}>Merchant: {squareMerchantId}</Text>
                  )}
                </View>
              </View>
              {isLoadingSquare || isCheckingSquareStatus ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : squareLinked ? (
                <View style={[styles.connectedBadge, {backgroundColor: `${colors.success}15`}]}>
                  <Icon name="check-circle" size={16} color={colors.success} />
                </View>
              ) : (
                <Icon name="chevron-right" size={20} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Subscription Section - Admin only */}
        {isAdmin && (
          <View style={[styles.section, {backgroundColor: colors.surface}]}>
            <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>Subscription</Text>
            <View style={[styles.sectionContent, {backgroundColor: colors.surface}]}>
              <SettingsItem
                icon="zap"
                label="Manage Plan"
                onPress={() => navigation.navigate('ManagePlan')}
              />
            </View>
          </View>
        )}

        {/* Company Section - Admin only */}
        {isAdmin && (
          <View style={[styles.section, {backgroundColor: colors.surface}]}>
            <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>Company</Text>
            <View style={[styles.sectionContent, {backgroundColor: colors.surface}]}>
              <SettingsItem
                icon="users"
                label="Team Management"
                onPress={handleTeamManagement}
                rightValue={isSubscribed
                  ? `${teamMembers.length}/${seatInfo.totalSeats} seats`
                  : 'Free · 1 seat'}
                rightValueColor={
                  !isSubscribed
                    ? colors.warning
                    : checkSeats(teamMembers.length).availableSeats === 0
                      ? colors.error
                      : checkSeats(teamMembers.length).availableSeats <= 2
                        ? colors.warning
                        : colors.accent
                }
              />
              <SettingsItem
                icon="clock"
                label="Time Cards"
                onPress={() => navigation.navigate('TimeCards')}
              />
              <SettingsItem
                icon="settings"
                label="Company Settings"
                onPress={handleCompanySettings}
              />
              <SettingsItem
                icon="package"
                label="Warehouses"
                onPress={() => navigation.navigate('Warehouses')}
              />
              <SettingsItem
                icon="download"
                label="Export Payments"
                onPress={() => navigation.navigate('ExportPayments')}
              />
            </View>
          </View>
        )}

        {/* App Section */}
        <View style={[styles.section, {backgroundColor: colors.surface}]}>
          <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>App</Text>
          <View style={[styles.sectionContent, {backgroundColor: colors.surface}]}>
            <SettingsItem
              icon="bell"
              label="Notifications"
              onPress={handleNotifications}
            />
            <SettingsItem
              icon="star"
              label="Leave a Review"
              onPress={handleLeaveReview}
            />
            <SettingsItem
              icon="shield"
              label="Privacy Policy"
              onPress={() => Linking.openURL('https://silkroadapp.com/privacy.html')}
            />
            <SettingsItem
              icon="file-text"
              label="Terms & Conditions"
              onPress={() => Linking.openURL('https://silkroadapp.com/terms.html')}
            />
          </View>
        </View>

        {/* Sign Out */}
        <View style={[styles.section, {backgroundColor: colors.surface}]}>
          <View style={[styles.sectionContent, {backgroundColor: colors.surface}]}>
            <SettingsItem
              icon="log-out"
              label="Sign Out"
              onPress={handleLogout}
              showChevron={false}
              destructive
            />
          </View>
        </View>

        {/* App Version */}
        <Text style={[styles.versionText, {color: colors.textSecondary}]}>SilkRoad v1.0.0</Text>
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
  themeToggle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,

  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    borderBottomWidth: 1,

  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: theme.spacing.md,
    marginBottom: 0,
  },
  companyLogoContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarContainer: {
    marginBottom: theme.spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,

    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,

    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,

  },
  userName: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',

    marginBottom: theme.spacing.xs,
  },
  userEmail: {
    fontSize: theme.fontSize.sm,

    marginBottom: theme.spacing.sm,
  },
  companyBadge: {
    flexDirection: 'row',
    alignItems: 'center',

    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  companyName: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',

    marginLeft: theme.spacing.xs,
  },
  companyRole: {
    fontSize: theme.fontSize.sm,

    marginLeft: theme.spacing.xs,
  },
  section: {
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',

    marginBottom: theme.spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {

    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,

  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  settingsItemBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
  },
  settingsItemBadgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  settingsItemLabel: {
    fontSize: theme.fontSize.md,

    marginLeft: theme.spacing.md,
  },
  settingsItemLabelDestructive: {
  },
  calendarItemText: {
    marginLeft: theme.spacing.md,
  },
  calendarEmailText: {
    fontSize: theme.fontSize.xs,

    marginTop: 2,
  },
  connectedBadge: {

    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  versionText: {
    fontSize: theme.fontSize.sm,

    textAlign: 'center',
    marginVertical: theme.spacing.xl,
  },
});
