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
import {useAuth} from '../../context/AuthContext';
import SilkRoadLogo from '../../assets/icons/Vector.svg';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {AuthStackParamList} from '../../types/navigation';

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

export const LoginScreen: React.FC<LoginScreenProps> = ({navigation}) => {
  const {login, isLoading} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{email?: string; password?: string}>({});

  const validateForm = (): boolean => {
    const newErrors: {email?: string; password?: string} = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Invalid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    try {
      await login({email: email.trim(), password});
    } catch (error: any) {
      Alert.alert(
        'Login Error',
        error.message || 'Please check your credentials and try again'
      );
    }
  };

  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* Logo/Header */}
          <View style={styles.header}>
            <View style={[styles.logoContainer, {backgroundColor: colors.accent}]}>
              <SilkRoadLogo width={90} height={84} />
            </View>
            <Text style={[styles.title, {color: colors.text}]}>Welcome </Text>
            <Text style={[styles.subtitle, {color: colors.textSecondary}]}>Sign in to continue</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, {color: colors.textSecondary}]}>Email</Text>
              <View style={[styles.inputWrapper, {backgroundColor: colors.surface, borderColor: colors.border}, errors.email && [styles.inputError, {borderColor: colors.error}]]}>
                <Icon name="mail" size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, {color: colors.text}]}
                  placeholder="your@email.com"
                  placeholderTextColor={colors.textSecondary}
                  value={email}
                  onChangeText={text => {
                    setEmail(text);
                    if (errors.email) setErrors({...errors, email: undefined});
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
              </View>
              {errors.email && <Text style={[styles.errorText, {color: colors.error}]}>{errors.email}</Text>}
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, {color: colors.textSecondary}]}>Password</Text>
              <View style={[styles.inputWrapper, {backgroundColor: colors.surface, borderColor: colors.border}, errors.password && [styles.inputError, {borderColor: colors.error}]]}>
                <Icon name="lock" size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.input, {color: colors.text}]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textSecondary}
                  value={password}
                  onChangeText={text => {
                    setPassword(text);
                    if (errors.password) setErrors({...errors, password: undefined});
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isLoading}>
                  <Icon
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={[styles.errorText, {color: colors.error}]}>{errors.password}</Text>}
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={isLoading}>
              <Text style={[styles.forgotPasswordText, {color: colors.accent}]}>Forgot your password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, {backgroundColor: colors.accent}, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.loginButtonText, {color: '#FFFFFF'}]}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, {backgroundColor: colors.border}]} />
              <Text style={[styles.dividerText, {color: colors.textSecondary}]}>or</Text>
              <View style={[styles.dividerLine, {backgroundColor: colors.border}]} />
            </View>

            {/* Register Link */}
            <View style={styles.registerContainer}>
              <Text style={[styles.registerText, {color: colors.textSecondary}]}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Register')}
                disabled={isLoading}>
                <Text style={[styles.registerLink, {color: colors.accent}]}>Sign Up</Text>
              </TouchableOpacity>
            </View>
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
    justifyContent: 'center',
  },

  header: {
    alignItems: 'center',
    paddingTop: theme.spacing.xl * 1.75,
    paddingBottom: theme.spacing.xl,
  },

  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: 40,

    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,

    // Shadow (iOS + Android)
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },

  logoText: {
    fontSize: 34,
    fontWeight: '900',

    letterSpacing: -1,
  },

  appTitle: {
    fontSize: 28,
    fontWeight: '800',

    letterSpacing: -1,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
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
  },

  // Optional: use this as a wrapper around inputs/buttons to look more premium
  formCard: {

    borderRadius: 24,
    borderWidth: 1,

    padding: theme.spacing.lg,

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  form: {
    flex: 1,
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

  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },

  forgotPasswordText: {
    fontSize: theme.fontSize.sm,

    fontWeight: '700',
  },

  loginButton: {

    borderRadius: 18,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,

    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },

  loginButtonDisabled: {
    opacity: 0.45,
  },

  loginButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '800',

    letterSpacing: 0.2,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },

  dividerLine: {
    flex: 1,
    height: 1,

  },

  dividerText: {
    fontSize: theme.fontSize.sm,

    marginHorizontal: theme.spacing.md,
  },

  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: theme.spacing.xl,
  },

  registerText: {
    fontSize: theme.fontSize.md,

  },

  registerLink: {
    fontSize: theme.fontSize.md,

    fontWeight: '800',
  },
});

