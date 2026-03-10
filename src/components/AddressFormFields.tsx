import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
} from 'react-native';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { AddressAutocomplete } from './AddressAutocomplete';
import type { GeocodingResult } from '../services/geocodingService';

export interface AddressFormData {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  latitude: number;
  longitude: number;
}

export const emptyAddressForm: AddressFormData = {
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  zipcode: '',
  country: 'USA',
  latitude: 0,
  longitude: 0,
};

interface AddressFormFieldsProps {
  formData: AddressFormData;
  onFormChange: (data: AddressFormData) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  sectionTitle?: string;
  showSectionTitle?: boolean;
  required?: boolean;
}

export const AddressFormFields: React.FC<AddressFormFieldsProps> = ({
  formData,
  onFormChange,
  searchValue,
  onSearchChange,
  sectionTitle = 'Address',
  showSectionTitle = true,
  required = false,
}) => {
  const { colors } = useTheme();
  const handleAddressSelect = useCallback((result: GeocodingResult) => {
    console.log('[AddressFormFields] Address selected:', result);
    onFormChange({
      ...formData,
      addressLine1: result.addressLine1,
      city: result.city,
      state: result.state,
      zipcode: result.zipcode,
      country: result.country || 'USA',
      latitude: result.latitude,
      longitude: result.longitude,
    });
    onSearchChange(result.formattedAddress || result.addressLine1);
  }, [formData, onFormChange, onSearchChange]);

  const updateField = useCallback((field: keyof AddressFormData, value: string) => {
    onFormChange({
      ...formData,
      [field]: value,
    });
  }, [formData, onFormChange]);

  return (
    <View style={styles.container}>
      {showSectionTitle && (
        <Text style={[styles.sectionTitle, {color: colors.textSecondary}]}>
          {sectionTitle} {required ? '' : '(Optional)'}
        </Text>
      )}

      <AddressAutocomplete
        value={searchValue}
        onChangeText={onSearchChange}
        onSelectAddress={handleAddressSelect}
        placeholder="Search for address"
        label="Address Search"
      />

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, {color: colors.text}]}>Street Address {required && '*'}</Text>
        <TextInput
          style={[styles.textInput, {backgroundColor: colors.surface, borderColor: colors.border, color: colors.text}]}
          value={formData.addressLine1}
          onChangeText={(t) => updateField('addressLine1', t)}
          placeholder="123 Main Street"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, {color: colors.text}]}>Apt, Suite, Unit</Text>
        <TextInput
          style={[styles.textInput, {backgroundColor: colors.surface, borderColor: colors.border, color: colors.text}]}
          value={formData.addressLine2}
          onChangeText={(t) => updateField('addressLine2', t)}
          placeholder="Suite 100"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={[styles.inputLabel, {color: colors.text}]}>City {required && '*'}</Text>
          <TextInput
            style={[styles.textInput, {backgroundColor: colors.surface, borderColor: colors.border, color: colors.text}]}
            value={formData.city}
            onChangeText={(t) => updateField('city', t)}
            placeholder="City"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
        <View style={styles.halfInput}>
          <Text style={[styles.inputLabel, {color: colors.text}]}>State {required && '*'}</Text>
          <TextInput
            style={[styles.textInput, {backgroundColor: colors.surface, borderColor: colors.border, color: colors.text}]}
            value={formData.state}
            onChangeText={(t) => updateField('state', t)}
            placeholder="State"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={[styles.inputLabel, {color: colors.text}]}>ZIP Code</Text>
          <TextInput
            style={[styles.textInput, {backgroundColor: colors.surface, borderColor: colors.border, color: colors.text}]}
            value={formData.zipcode}
            onChangeText={(t) => updateField('zipcode', t)}
            placeholder="12345"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.halfInput}>
          <Text style={[styles.inputLabel, {color: colors.text}]}>Country</Text>
          <TextInput
            style={[styles.textInput, {backgroundColor: colors.surface, borderColor: colors.border, color: colors.text}]}
            value={formData.country}
            onChangeText={(t) => updateField('country', t)}
            placeholder="USA"
            placeholderTextColor={colors.textSecondary}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,

    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
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
    borderWidth: 1,

    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,

  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  halfInput: {
    flex: 1,
    marginBottom: theme.spacing.md,
  },
});

export default AddressFormFields;
