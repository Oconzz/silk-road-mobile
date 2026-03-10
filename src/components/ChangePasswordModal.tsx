import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';

interface ChangePasswordModalProps {
  visible: boolean;
  onChangePassword: (newPassword: string) => Promise<void>;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  visible,
  onChangePassword,
  onClose,
}) => {
  const {colors} = useTheme();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validatePassword = (password: string): boolean => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return regex.test(password);
  };

  const handleSubmit = async () => {
    // Validation
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!validatePassword(newPassword)) {
      Alert.alert(
        'Invalid Password',
        'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number'
      );
      return;
    }

    try {
      setIsLoading(true);
      await onChangePassword(newPassword);
      // Reset form
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.container, {backgroundColor: colors.surface}]}>
          {/* Header with Close Button */}
          <View style={styles.headerRow}>
            <View style={styles.headerContent}>
              <Icon name="lock" size={32} color={colors.accent} />
              <Text style={[styles.title, {color: colors.text}]}>Change Password</Text>
              <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
                For security reasons, we recommend changing your password on first login.
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.closeButton, {backgroundColor: colors.accent}]} 
              onPress={onClose}
              disabled={isLoading}
            >
              <Icon name="x" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* New Password */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, {color: colors.textSecondary}]}>New Password</Text>
              <View style={[styles.inputWrapper, {backgroundColor: colors.background}]}>
                <TextInput                   style={[styles.input, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={[styles.eyeButton, {backgroundColor: colors.surface}]}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                >
                  <Icon
                    name={showNewPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              <Text style={[styles.hint, {color: colors.textSecondary}]}>
                At least 8 characters with 1 uppercase, 1 lowercase, and 1 number
              </Text>
            </View>

            {/* Confirm Password */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, {color: colors.textSecondary}]}>Confirm New Password</Text>
              <View style={[styles.inputWrapper, {backgroundColor: colors.background}]}>
                <TextInput                   style={[styles.input, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={[styles.eyeButton, {backgroundColor: colors.surface}]}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Icon
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity             style={[styles.submitButton, {backgroundColor: colors.accent}, isLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.textLight} />
            ) : (
              <Text style={[styles.submitButtonText, {color: colors.textLight}]}>Change Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  container: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.lg,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: theme.spacing.xs,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',

    marginTop: theme.spacing.md,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,

    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 20,
  },
  form: {
    gap: theme.spacing.md,
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',

    marginBottom: theme.spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.fontSize.md,

  },
  eyeButton: {
    padding: theme.spacing.md,
  },
  hint: {
    fontSize: theme.fontSize.xs,

    marginTop: theme.spacing.xs,
  },
  submitButton: {

    borderRadius: theme.borderRadius.md,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',

  },
});

export default ChangePasswordModal;
