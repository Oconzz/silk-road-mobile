import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { geocodingService, type PlacePrediction, type GeocodingResult } from '../services/geocodingService';

interface AddressAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectAddress: (address: GeocodingResult) => void;
  placeholder?: string;
  label?: string;
  error?: string;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChangeText,
  onSelectAddress,
  placeholder = 'Enter address',
  label,
  error,
}) => {
  const {colors} = useTheme();
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSelectingRef = useRef(false);

  useEffect(() => {
    console.log('[AddressAutocomplete] Component mounted');
    console.log('[AddressAutocomplete] Testing geocodingService...');
    geocodingService.testApiKey().then(result => {
      console.log('[AddressAutocomplete] API Key test result:', result);
    });
  }, []);

  const handleTextChange = useCallback((text: string) => {
    console.log('[AddressAutocomplete] handleTextChange called with:', text, 'isSelecting:', isSelectingRef.current);
    onChangeText(text);
    
    // Don't reopen dropdown if we're in the middle of selecting an address
    if (isSelectingRef.current) {
      console.log('[AddressAutocomplete] Skipping prediction update - selection in progress');
      return;
    }
    
    setShowPredictions(true);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    if (text.length < 3) {
      console.log('[AddressAutocomplete] Text too short, clearing predictions');
      setPredictions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    console.log('[AddressAutocomplete] Setting up debounced search...');

    debounceTimeout.current = setTimeout(async () => {
      console.log('[AddressAutocomplete] Debounce timeout fired, calling geocodingService...');
      try {
        const results = await geocodingService.getPlacePredictions(text);
        console.log('[AddressAutocomplete] Received predictions:', results.length);
        setPredictions(results);
      } catch (error) {
        console.error('[AddressAutocomplete] Error fetching predictions:', error);
        setPredictions([]);
      } finally {
        setIsLoading(false);
      }
    }, 500);
  }, [onChangeText]);

  const handleSelectPrediction = useCallback(async (prediction: PlacePrediction) => {
    console.log('[AddressAutocomplete] Suggestion selected:', prediction.description);
    try {
      isSelectingRef.current = true;
      setIsLoading(true);
      setShowPredictions(false);
      setPredictions([]);
      
      console.log('[AddressAutocomplete] Fetching place details for:', prediction.placeId);
      const details = await geocodingService.getPlaceDetails(prediction.placeId);
      
      if (details) {
        console.log('[AddressAutocomplete] Place details received:', details);
        onSelectAddress(details);
        // Use formattedAddress or fall back to addressLine1
        const displayAddress = details.formattedAddress || details.addressLine1 || prediction.description;
        console.log('[AddressAutocomplete] Setting display address:', displayAddress);
        onChangeText(displayAddress);
        Keyboard.dismiss();
      } else {
        console.error('[AddressAutocomplete] No place details returned');
        // Fall back to prediction description
        onChangeText(prediction.description);
      }
    } catch (error) {
      console.error('[AddressAutocomplete] Error getting place details:', error);
    } finally {
      setIsLoading(false);
      // Reset flag after a small delay to ensure onChangeText has been processed
      setTimeout(() => {
        isSelectingRef.current = false;
      }, 100);
    }
  }, [onChangeText, onSelectAddress]);

  const renderPrediction = useCallback((item: PlacePrediction) => (
    <TouchableOpacity
      key={item.placeId}
      style={[styles.predictionItem, {borderBottomColor: colors.border}]}
      onPress={() => handleSelectPrediction(item)}
      activeOpacity={0.7}
    >
      <Icon name="map-pin" size={18} color={colors.accent} style={styles.predictionIcon} />
      <View style={styles.predictionText}>
        <Text style={[styles.predictionMainText, {color: colors.text}]}>{item.mainText}</Text>
        <Text style={[styles.predictionSecondaryText, {color: colors.textSecondary}]}>{item.secondaryText}</Text>
      </View>
    </TouchableOpacity>
  ), [handleSelectPrediction]);

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, {color: colors.text}]}>{label}</Text>}
      
      <View style={[styles.inputContainer, {backgroundColor: colors.surface, borderColor: colors.border}, error && [styles.inputContainerError, {borderColor: colors.error}]]}>
        <Icon name="map-pin" size={20} color={colors.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, {color: colors.text}]}
          value={value}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="words"
          autoCorrect={false}
          onFocus={() => {
            if (predictions.length > 0) {
              setShowPredictions(true);
            }
          }}
        />
        {isLoading && (
          <ActivityIndicator size="small" color={colors.accent} style={styles.loader} />
        )}
      </View>

      {error && <Text style={[styles.errorText, {color: colors.error}]}>{error}</Text>}

      {showPredictions && predictions.length > 0 && (
        <View style={[styles.predictionsContainer, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <ScrollView
            style={styles.predictionsList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={predictions.length > 3}
          >
            {predictions.map(renderPrediction)}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
    zIndex: 1000,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

    marginBottom: theme.spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    paddingHorizontal: theme.spacing.md,
  },
  inputContainerError: {
  },
  inputIcon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: theme.fontSize.md,

  },
  loader: {
    marginLeft: theme.spacing.sm,
  },
  errorText: {
    fontSize: theme.fontSize.sm,

    marginTop: theme.spacing.xs,
  },
  predictionsContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,

    borderRadius: theme.borderRadius.md,
    borderWidth: 1,

    ...theme.shadow.lg,
    maxHeight: 250,
    overflow: 'hidden',
    zIndex: 9999,
    elevation: 10,
  },
  predictionsList: {
    flexGrow: 0,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,

  },
  predictionIcon: {
    marginRight: theme.spacing.sm,
  },
  predictionText: {
    flex: 1,
  },
  predictionMainText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

    marginBottom: 2,
  },
  predictionSecondaryText: {
    fontSize: theme.fontSize.sm,

  },
});
