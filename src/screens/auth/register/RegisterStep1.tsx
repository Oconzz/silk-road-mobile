import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {theme} from '../../../theme';
import {useTheme} from '../../../context/ThemeContext';
import type {RegisterFormData} from '../RegisterScreen';

interface RegisterStep1Props {
  formData: RegisterFormData;
  updateFormData: (data: Partial<RegisterFormData>) => void;
  onNext: () => void;
}

export const RegisterStep1: React.FC<RegisterStep1Props> = ({
  formData,
  updateFormData,
  onNext,
}) => {
  const { colors } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 3) {
      newErrors.fullName = 'Name must be at least 3 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email';
    }

    if (formData.phone.trim() && formData.phone.replace(/\D/g, '').length !== 10) {
      newErrors.phone = 'Phone must be 10 digits';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase and numbers';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Password confirmation is required';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateForm()) {
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        setLoading(false);
        onNext();
      }, 500);
    }
  };

  const formatPhone = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    
    // US phone format: (XXX) XXX-XXXX
    if (cleaned.length >= 6) {
      formatted = cleaned.replace(/(\d{3})(\d{3})(\d{0,4})/, '($1) $2-$3');
    } else if (cleaned.length >= 3) {
      formatted = cleaned.replace(/(\d{3})(\d{0,3})/, '($1) $2');
    }
    
    return formatted.trim();
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <Text style={[styles.title, {color: colors.text}]}>Personal Information</Text>
      <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
        Start by creating your account with your personal information
      </Text>

      {/* Full Name */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, {color: colors.textSecondary}]}>Full Name *</Text>
        <View style={[styles.inputWrapper, {backgroundColor: colors.surface, borderColor: colors.border}, errors.fullName && [styles.inputError, {borderColor: colors.error}]]}>
          <Icon name="user" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, {color: colors.text}]}
            placeholder="John Doe"
            placeholderTextColor={colors.textSecondary}
            value={formData.fullName}
            onChangeText={text => {
              updateFormData({fullName: text});
              if (errors.fullName) {
                const {fullName, ...rest} = errors;
                setErrors(rest);
              }
            }}
            autoCapitalize="words"
            editable={!loading}
            textContentType="name"
            autoComplete="name"
          />
        </View>
        {errors.fullName && <Text style={[styles.errorText, {color: colors.error}]}>{errors.fullName}</Text>}
      </View>

      {/* Email */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, {color: colors.textSecondary}]}>Email *</Text>
        <View style={[styles.inputWrapper, {backgroundColor: colors.surface, borderColor: colors.border}, errors.email && [styles.inputError, {borderColor: colors.error}]]}>
          <Icon name="mail" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, {color: colors.text}]}
            placeholder="your@email.com"
            placeholderTextColor={colors.textSecondary}
            value={formData.email}
            onChangeText={text => {
              updateFormData({email: text});
              if (errors.email) {
                const {email, ...rest} = errors;
                setErrors(rest);
              }
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            textContentType="emailAddress"
            autoComplete="email"
          />
        </View>
        {errors.email && <Text style={[styles.errorText, {color: colors.error}]}>{errors.email}</Text>}
      </View>

      {/* Phone */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, {color: colors.textSecondary}]}>Phone (optional)</Text>
        <View style={[styles.inputWrapper, {backgroundColor: colors.surface, borderColor: colors.border}, errors.phone && [styles.inputError, {borderColor: colors.error}]]}>
          <Icon name="phone" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, {color: colors.text}]}
            placeholder="(555) 123-4567"
            placeholderTextColor={colors.textSecondary}
            value={formData.phone}
            onChangeText={text => {
              const formatted = formatPhone(text);
              updateFormData({phone: formatted});
              if (errors.phone) {
                const {phone, ...rest} = errors;
                setErrors(rest);
              }
            }}
            keyboardType="phone-pad"
            maxLength={14}
            editable={!loading}
            textContentType="telephoneNumber"
            autoComplete="tel"
          />
        </View>
        {errors.phone && <Text style={[styles.errorText, {color: colors.error}]}>{errors.phone}</Text>}
      </View>

      {/* Password */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, {color: colors.textSecondary}]}>Password *</Text>
        <View style={[styles.inputWrapper, {backgroundColor: colors.surface, borderColor: colors.border}, errors.password && [styles.inputError, {borderColor: colors.error}]]}>
          <Icon name="lock" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, {color: colors.text}]}
            placeholder="••••••••"
            placeholderTextColor={colors.textSecondary}
            value={formData.password}
            onChangeText={text => {
              updateFormData({password: text});
              if (errors.password) {
                const {password, ...rest} = errors;
                setErrors(rest);
              }
            }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            textContentType="newPassword"
            autoComplete="password-new"
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            disabled={loading}>
            <Icon
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={[styles.errorText, {color: colors.error}]}>{errors.password}</Text>}
        <Text style={[styles.hint, {color: colors.textSecondary}]}>
          Minimum 8 characters with uppercase, lowercase and numbers
        </Text>
      </View>

      {/* Confirm Password */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, {color: colors.textSecondary}]}>Confirm Password *</Text>
        <View style={[styles.inputWrapper, {backgroundColor: colors.surface, borderColor: colors.border}, errors.confirmPassword && [styles.inputError, {borderColor: colors.error}]]}>
          <Icon name="lock" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, {color: colors.text}]}
            placeholder="••••••••"
            placeholderTextColor={colors.textSecondary}
            value={formData.confirmPassword}
            onChangeText={text => {
              updateFormData({confirmPassword: text});
              if (errors.confirmPassword) {
                const {confirmPassword, ...rest} = errors;
                setErrors(rest);
              }
            }}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            textContentType="newPassword"
            autoComplete="password-new"
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            disabled={loading}>
            <Icon
              name={showConfirmPassword ? 'eye-off' : 'eye'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
        {errors.confirmPassword && (
          <Text style={[styles.errorText, {color: colors.error}]}>{errors.confirmPassword}</Text>
        )}
      </View>

      {/* Next Button */}
      <TouchableOpacity         style={[styles.nextButton, {backgroundColor: colors.accent}, loading && styles.nextButtonDisabled]}
        onPress={handleNext}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <>
            <Text style={[styles.nextButtonText, {color: '#FFFFFF'}]}>Continue</Text>
            <Icon name="arrow-right" size={20} color={colors.background} />
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',

    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.fontSize.md,

    marginBottom: theme.spacing.xl,
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',

    marginBottom: theme.spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    paddingHorizontal: theme.spacing.md,
    height: 56,
  },
  inputError: {
  },
  input: {
    flex: 1,
    fontSize: theme.fontSize.md,

    marginLeft: theme.spacing.sm,
    marginRight: theme.spacing.sm,
  },
  errorText: {
    fontSize: theme.fontSize.sm,

    marginTop: theme.spacing.xs,
  },
  hint: {
    fontSize: theme.fontSize.sm,

    marginTop: theme.spacing.xs,
  },
  nextButton: {

    borderRadius: theme.borderRadius.md,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xl,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',

    marginRight: theme.spacing.sm,
  },
});
