import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { RegisterStep1 } from './register/RegisterStep1';
import { RegisterStep2 } from './register/RegisterStep2';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types/navigation';

type RegisterScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
};

export interface RegisterFormData {
  // Step 1 - User Info
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;

  // Step 2 - Company Info
  companyName: string;
  companyLogo?: string;
  category: string;  // Business category (e.g., "Painting", "Roofing")
  city: string;
  state: string;
  zipcode: string;
  country: string;

  // All users register as Admin of their own company
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<RegisterFormData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    companyName: '',
    category: '',
    city: '',
    state: '',
    zipcode: '',
    country: 'US',
  });

  const totalSteps = 2;

  const updateFormData = (data: Partial<RegisterFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <RegisterStep1
            formData={formData}
            updateFormData={updateFormData}
            onNext={handleNext}
          />
        );
      case 2:
        return (
          <RegisterStep2
            formData={formData}
            updateFormData={updateFormData}
            onComplete={() => navigation.navigate('Login')}
          />
        );
      default:
        return null;
    }
  };

  const { colors, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Header */}
      <View style={[styles.header, {backgroundColor: colors.surface}, {borderBottomColor: colors.border}]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Icon name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Account</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Progress Indicator */}
      <View style={[styles.progressContainer, {backgroundColor: colors.background}]}>
        {/* Step 1 */}
        <View style={styles.progressStepWrapper}>
          <View
            style={[
              styles.progressStep,
              currentStep >= 1 && [styles.progressStepActive, {backgroundColor: colors.accent}],
            ]}>
            {currentStep > 1 ? (
              <Icon name="check" size={16} color={colors.background} />
            ) : (
              <Text
                style={[
                  styles.progressStepText,
                  currentStep >= 1 && [styles.progressStepTextActive, {color: colors.textLight}],
                ]}>
                1
              </Text>
            )}
          </View>
          <Text style={[styles.stepLabel, {color: colors.textSecondary}, currentStep === 1 && styles.stepLabelActive]}>
            Personal Info
          </Text>
        </View>

        {/* Line between steps */}
        <View
          style={[
            styles.progressLine,
            currentStep > 1 && [styles.progressLineActive, {backgroundColor: colors.accent}],
          ]}
        />

        {/* Step 2 */}
        <View style={styles.progressStepWrapper}>
          <View
            style={[
              styles.progressStep,
              currentStep >= 2 && [styles.progressStepActive, {backgroundColor: colors.accent}],
            ]}>
            {currentStep > 2 ? (
              <Icon name="check" size={16} color={colors.background} />
            ) : (
              <Text
                style={[
                  styles.progressStepText,
                  currentStep >= 2 && [styles.progressStepTextActive, {color: colors.textLight}],
                ]}>
                2
              </Text>
            )}
          </View>
          <Text style={[styles.stepLabel, {color: colors.textSecondary}, currentStep === 2 && styles.stepLabelActive]}>
            Company
          </Text>
        </View>
      </View>

      {/* Step Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={true}
        showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollView>

      {/* Login Link */}
      <View style={[styles.footer, {borderTopColor: colors.border}]}>
        <Text style={[styles.footerText, {color: colors.text}]}>Already have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={[styles.footerLink, {color: colors.text}]}>Sign In</Text>
        </TouchableOpacity>
      </View>
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
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  progressStepWrapper: {
    alignItems: 'center',
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,

    borderWidth: 2,

    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStepActive: {
  },
  progressStepText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',

  },
  progressStepTextActive: {
  },
  progressLine: {
    width: 60,
    height: 2,

    marginHorizontal: theme.spacing.sm,
  },
  progressLineActive: {
  },
  stepLabel: {
    fontSize: theme.fontSize.xs,

    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  stepLabelActive: {

    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    borderTopWidth: 1,

  },
  footerText: {
    fontSize: theme.fontSize.md,

  },
  footerLink: {
    fontSize: theme.fontSize.md,

    fontWeight: '700',
  },
});
