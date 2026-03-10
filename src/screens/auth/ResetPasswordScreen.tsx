import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {theme} from '../../theme';
import {useTheme} from '../../context/ThemeContext';
import {authService} from '../../services/api/domain/auth/authService';
import SilkRoadLogo from '../../assets/icons/Vector.svg';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RouteProp} from '@react-navigation/native';
import type {AuthStackParamList} from '../../types/navigation';

type ResetPasswordScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ResetPassword'>;
  route: RouteProp<AuthStackParamList, 'ResetPassword'>;
};

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({navigation, route}) => {
  const token = route.params?.token ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{newPassword?: string; confirmPassword?: string; token?: string}>({});
  const {colors, isDark} = useTheme();

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!token) {
      newErrors.token = 'Invalid or missing reset token. Please request a new reset link.';
    }

    if (!newPassword) {
      newErrors.newPassword = 'Password is required';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {
      await authService.resetPassword({token, newPassword});
      Alert.alert(
        'Password Reset',
        'Your password has been reset successfully. You can now sign in with your new password.',
        [
          {
            text: 'Sign In',
            onPress: () => navigation.navigate('Login'),
          },
        ],
      );
    } catch (err: any) {
      Alert.alert(
        'Reset Failed',
        err.message || 'Failed to reset password. The link may have expired. Please request a new one.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <View style={styles.errorContainer}>
          <View style={[styles.iconCircle, {backgroundColor: colors.surface}]}>
            <Icon name="alert-circle" size={40} color={theme.colors.error} />
          </View>
          <Text style={[styles.errorTitle, {color: colors.text}]}>Invalid Reset Link</Text>
          <Text style={[styles.errorMessage, {color: colors.textSecondary}]}>
            This reset link is invalid or has expired. Please request a new password reset.
          </Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.actionButtonText}>Request New Link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.secondaryButtonText, {color: colors.textSecondary}]}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Login')}>
            <Icon name="arrow-left" size={24} color={colors.text} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <SilkRoadLogo width={120} height={112} />
            </View>
            <Text style={[styles.title, {color: colors.text}]}>Reset Password</Text>
            <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
              Create a new password for your account.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* New Password */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, {color: colors.textSecondary}]}>New Password</Text>
              <View style={[styles.inputWrapper, {backgroundColor: colors.surface, borderColor: colors.border}, errors.newPassword && styles.inputError]}>
                <Icon name="lock" size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, {color: colors.text}]}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={colors.textSecondary}
                  value={newPassword}
                  onChangeText={text => {
                    setNewPassword(text);
                    if (errors.newPassword) setErrors({...errors, newPassword: undefined});
                  }}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  disabled={isLoading}>
                  <Icon
                    name={showNewPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {errors.newPassword && <Text style={styles.fieldError}>{errors.newPassword}</Text>}
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, {color: colors.textSecondary}]}>Confirm Password</Text>
              <View style={[styles.inputWrapper, {backgroundColor: colors.surface, borderColor: colors.border}, errors.confirmPassword && styles.inputError]}>
                <Icon name="lock" size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, {color: colors.text}]}
                  placeholder="Re-enter password"
                  placeholderTextColor={colors.textSecondary}
                  value={confirmPassword}
                  onChangeText={text => {
                    setConfirmPassword(text);
                    if (errors.confirmPassword) setErrors({...errors, confirmPassword: undefined});
                  }}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}>
                  <Icon
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && <Text style={styles.fieldError}>{errors.confirmPassword}</Text>}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color={theme.colors.background} />
              ) : (
                <Text style={styles.submitButtonText}>Reset Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  backButton: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    alignSelf: 'flex-start',
  },
  header: {
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: {width: 0, height: 10},
    elevation: 6,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.md,
    lineHeight: 22,
  },
  form: {
    marginTop: theme.spacing.lg,
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    height: 56,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  input: {
    flex: 1,
    fontSize: theme.fontSize.md,
    marginLeft: theme.spacing.sm,
    marginRight: theme.spacing.sm,
  },
  fieldError: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  submitButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 18,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 10},
    elevation: 5,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '800',
    color: theme.colors.background,
    letterSpacing: 0.2,
  },
  // Error/no-token state
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 3,
  },
  errorTitle: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.xl,
  },
  actionButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 18,
    height: 56,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 10},
    elevation: 5,
  },
  actionButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '800',
    color: theme.colors.background,
    letterSpacing: 0.2,
  },
  secondaryButton: {
    paddingVertical: theme.spacing.sm,
  },
  secondaryButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
});
