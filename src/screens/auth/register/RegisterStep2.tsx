import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  FlatList,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { launchImageLibrary } from 'react-native-image-picker';
import { theme } from '../../../theme';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import type { RegisterFormData } from '../RegisterScreen';
import { BUSINESS_CATEGORIES } from '../../../types/quickStartTemplate';
import { AddressAutocomplete } from '../../../components/AddressAutocomplete';
import type { GeocodingResult } from '../../../services/geocodingService';

interface RegisterStep2Props {
  formData: RegisterFormData;
  updateFormData: (data: Partial<RegisterFormData>) => void;
  onComplete: () => void;
}

export const RegisterStep2: React.FC<RegisterStep2Props> = ({
  formData,
  updateFormData,
  onComplete,
}) => {
  const { colors } = useTheme();
  const { register, isLoading: authLoading } = useAuth();
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [addressSearchText, setAddressSearchText] = useState('');

  const handleAddressSelect = (address: GeocodingResult) => {
    setAddressSearchText(address.formattedAddress);
    updateFormData({
      city: address.city,
      state: address.state,
      zipcode: address.zipcode,
      country: address.country,
    });
    if (errors.city) {
      const { city, ...rest } = errors;
      setErrors(rest);
    }
    if (errors.state) {
      const { state, ...rest } = errors;
      setErrors(rest);
    }
    if (errors.zipcode) {
      const { zipcode, ...rest } = errors;
      setErrors(rest);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (formData.companyName.trim() && formData.companyName.trim().length < 2) {
      newErrors.companyName = 'Name must be at least 2 characters';
    }

    if (formData.zipcode.trim()) {
      const digits = formData.zipcode.replace(/\D/g, '');
      if (digits.length !== 5 && digits.length !== 9) {
        newErrors.zipcode = 'ZIP code must be 5 or 9 digits (e.g., 12345 or 12345-6789)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleComplete = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await register({
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        fullName: formData.fullName,
        phone: formData.phone,
        city: formData.city,
        state: formData.state,
        zipcode: formData.zipcode,
        country: formData.country,
        company: formData.companyName,
        companyLogo: formData.companyLogo,
        category: formData.category,
      });

      onComplete();
    } catch (error: any) {
      const errorMsg = error.message || 'Unable to create your account. Please try again.';
      const isEmailTaken = errorMsg.toLowerCase().includes('already exists') || errorMsg.toLowerCase().includes('email');
      Alert.alert(
        isEmailTaken ? 'Email Already In Use' : 'Error Creating Account',
        errorMsg
      );
    } finally {
      setLoading(false);
    }
  };

  const formatZipcode = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 5) {
      return cleaned;
    }
    return cleaned.replace(/(\d{5})(\d{0,4})/, '$1-$2');
  };

  const handleSelectLogo = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1024,
        maxHeight: 1024,
        includeBase64: true,
      });

      if (result.didCancel) {
        return;
      }

      if (result.errorCode) {
        Alert.alert('Error', 'Could not select image');
        return;
      }

      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          setUploadingLogo(true);
          // Simulate upload delay
          setTimeout(() => {
            const base64Image = `data:${asset.type};base64,${asset.base64}`;
            updateFormData({ companyLogo: base64Image });
            setUploadingLogo(false);
          }, 1000);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Could not process image');
    }
  };

  const handleRemoveLogo = () => {
    updateFormData({ companyLogo: undefined });
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <Text style={[styles.title, {color: colors.text}]}>Company Information</Text>
      <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
        Set up your company and add a logo that will appear on estimates
      </Text>

      {/* Company Logo */}
      <View style={styles.logoSection}>
        <Text style={[styles.label, {color: colors.textSecondary}]}>Company Logo (optional)</Text>
        <Text style={[styles.hint, {color: colors.textSecondary}]}>
          The logo will appear on estimates sent to clients
        </Text>

        {formData.companyLogo ? (
          <View style={styles.logoPreviewContainer}>
            <Image
              source={{ uri: formData.companyLogo }}
              style={[styles.logoPreview, {borderColor: colors.border}]}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={[styles.removeLogoButton, {backgroundColor: colors.error}]}
              onPress={handleRemoveLogo}
              disabled={uploadingLogo}>
              <Icon name="x" size={20} color={colors.background} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.uploadLogoButton, {backgroundColor: colors.surface, borderColor: colors.border}]}
            onPress={handleSelectLogo}
            disabled={uploadingLogo}>
            {uploadingLogo ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Icon name="upload" size={32} color={colors.accent} />
                <Text style={[styles.uploadLogoText, {color: colors.text}]}>Add Logo</Text>
                <Text style={[styles.uploadLogoHint, {color: colors.textSecondary}]}>PNG, JPG up to 5MB</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Company Name */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, {color: colors.textSecondary}]}>Company Name (optional)</Text>
        <View style={[styles.inputWrapper, {backgroundColor: colors.surface, borderColor: colors.border}, errors.companyName && [styles.inputError, {borderColor: colors.error}]]}>
          <Icon name="briefcase" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, {color: colors.text}]}
            placeholder="My Company LLC"
            placeholderTextColor={colors.textSecondary}
            value={formData.companyName}
            onChangeText={text => {
              updateFormData({ companyName: text });
              if (errors.companyName) {
                const { companyName, ...rest } = errors;
                setErrors(rest);
              }
            }}
            autoCapitalize="words"
            editable={!loading}
          />
        </View>
        {errors.companyName && <Text style={[styles.errorText, {color: colors.error}]}>{errors.companyName}</Text>}
      </View>

      {/* Business Category */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, {color: colors.textSecondary}]}>Business Category (optional)</Text>
        <TouchableOpacity
          style={[styles.inputWrapper, {backgroundColor: colors.surface, borderColor: colors.border}, errors.category && [styles.inputError, {borderColor: colors.error}]]}
          onPress={() => setShowCategoryModal(true)}
          disabled={loading}>
          <Icon name="tag" size={20} color={colors.textSecondary} />
          <Text style={[styles.input, {color: formData.category ? colors.text : colors.textSecondary}]}>
            {formData.category || 'Select a category'}
          </Text>
          <Icon name="chevron-down" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        {errors.category && <Text style={[styles.errorText, {color: colors.error}]}>{errors.category}</Text>}
      </View>

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
         animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}>
          <View style={[styles.modalContent, {backgroundColor: colors.surface}]}>
            <View style={[styles.modalHeader, {backgroundColor: colors.surface}, {borderBottomColor: colors.border}]}>
              <Text style={[styles.modalTitle, {color: colors.text}]}>Select Business Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Icon name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={BUSINESS_CATEGORIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.categoryItem,
                    {borderBottomColor: colors.border},
                    formData.category === item && [styles.categoryItemSelected, {backgroundColor: `${colors.accent}15`}],
                  ]}
                  onPress={() => {
                    updateFormData({ category: item });
                    if (errors.category) {
                      const { category, ...rest } = errors;
                      setErrors(rest);
                    }
                    setShowCategoryModal(false);
                  }}>
                  <Text style={[
                    styles.categoryItemText,
                    {color: colors.text},
                    formData.category === item && styles.categoryItemTextSelected,
                  ]}>
                    {item}
                  </Text>
                  {formData.category === item && (
                    <Icon name="check" size={20} color={colors.accent} />
                  )}
                </TouchableOpacity>
              )}
              style={styles.categoryList}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Address Search */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, {color: colors.textSecondary}]}>Search Address</Text>
        <AddressAutocomplete
          value={addressSearchText}
          onChangeText={setAddressSearchText}
          onSelectAddress={handleAddressSelect}
          placeholder="Search for your address..."
        />
        <Text style={[styles.hint, {color: colors.textSecondary}]}>
          Search to auto-fill city, state and ZIP code
        </Text>
      </View>

      {/* City */}
      <View style={styles.inputContainer}>
        <Text style={[styles.label, {color: colors.textSecondary}]}>City (optional)</Text>
        <View style={[styles.inputWrapper, {backgroundColor: colors.surface, borderColor: colors.border}, errors.city && [styles.inputError, {borderColor: colors.error}]]}>
          <Icon name="map-pin" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, {color: colors.text}]}
            placeholder="New York"
            placeholderTextColor={colors.textSecondary}
            value={formData.city}
            onChangeText={text => {
              updateFormData({ city: text });
              if (errors.city) {
                const { city, ...rest } = errors;
                setErrors(rest);
              }
            }}
            autoCapitalize="words"
            editable={!loading}
          />
        </View>
        {errors.city && <Text style={[styles.errorText, {color: colors.error}]}>{errors.city}</Text>}
      </View>

      {/* State and Zipcode Row */}
      <View style={styles.row}>
        <View style={[styles.inputContainer, styles.halfWidth]}>
          <Text style={[styles.label, {color: colors.textSecondary}]}>State (optional)</Text>
          <View style={[styles.inputWrapper, {backgroundColor: colors.surface, borderColor: colors.border}, errors.state && [styles.inputError, {borderColor: colors.error}]]}>
            <TextInput
              style={[styles.input, {color: colors.text}]}
              placeholder="NY"
              placeholderTextColor={colors.textSecondary}
              value={formData.state}
              onChangeText={text => {
                updateFormData({ state: text.toUpperCase() });
                if (errors.state) {
                  const { state, ...rest } = errors;
                  setErrors(rest);
                }
              }}
              autoCapitalize="characters"
              maxLength={2}
              editable={!loading}
            />
          </View>
          {errors.state && <Text style={[styles.errorText, {color: colors.error}]}>{errors.state}</Text>}
        </View>

        <View style={[styles.inputContainer, styles.halfWidth]}>
          <Text style={[styles.label, {color: colors.textSecondary}]}>ZIP Code (optional)</Text>
          <View style={[styles.inputWrapper, {backgroundColor: colors.surface, borderColor: colors.border}, errors.zipcode && [styles.inputError, {borderColor: colors.error}]]}>
            <TextInput
              style={[styles.input, {color: colors.text}]}
              placeholder="12345"
              placeholderTextColor={colors.textSecondary}
              value={formData.zipcode}
              onChangeText={text => {
                const formatted = formatZipcode(text);
                updateFormData({ zipcode: formatted });
                if (errors.zipcode) {
                  const { zipcode, ...rest } = errors;
                  setErrors(rest);
                }
              }}
              keyboardType="number-pad"
              maxLength={10}
              editable={!loading}
            />
          </View>
          {errors.zipcode && <Text style={[styles.errorText, {color: colors.error}]}>{errors.zipcode}</Text>}
        </View>
      </View>

      {/* Create Account Button */}
      <TouchableOpacity         style={[styles.nextButton, {backgroundColor: colors.accent}, (loading || authLoading) && styles.nextButtonDisabled]}
        onPress={handleComplete}
        disabled={loading || authLoading}>
        {(loading || authLoading) ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <>
            <Text style={[styles.nextButtonText, {color: '#FFFFFF'}]}>Create Account</Text>
            <Icon name="check" size={20} color={colors.background} />
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
  logoSection: {
    marginBottom: theme.spacing.xl,
  },
  logoPreviewContainer: {
    position: 'relative',
    alignSelf: 'center',
    marginTop: theme.spacing.md,
  },
  logoPreview: {
    width: 160,
    height: 160,
    borderRadius: theme.borderRadius.lg,

    borderWidth: 2,

  },
  removeLogoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 32,
    height: 32,
    borderRadius: 16,

    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  uploadLogoButton: {
    height: 160,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,

    borderStyle: 'dashed',

    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
  },
  uploadLogoText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',

    marginTop: theme.spacing.sm,
  },
  uploadLogoHint: {
    fontSize: theme.fontSize.sm,

    marginTop: theme.spacing.xs,
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
  },
  errorText: {
    fontSize: theme.fontSize.sm,

    marginTop: theme.spacing.xs,
  },
  hint: {
    fontSize: theme.fontSize.sm,

    marginTop: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  placeholderText: {
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {

    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,

  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',

  },
  categoryList: {
    paddingHorizontal: theme.spacing.md,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,

  },
  categoryItemSelected: {
  },
  categoryItemText: {
    fontSize: theme.fontSize.md,

  },
  categoryItemTextSelected: {

    fontWeight: '600',
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
