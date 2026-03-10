import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { Button } from './Button';
import { geocodingService, type GeocodingResult } from '../services/geocodingService';

interface LocationMapPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (location: GeocodingResult) => void;
  initialLocation?: {
    latitude: number;
    longitude: number;
  };
}

const DEFAULT_REGION = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

export const LocationMapPicker: React.FC<LocationMapPickerProps> = ({
  visible,
  onClose,
  onSelectLocation,
  initialLocation,
}) => {
  const {colors} = useTheme();
  console.log('[LocationMapPicker] Component rendered', {visible, initialLocation});
  
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(
    initialLocation
      ? { ...initialLocation, latitudeDelta: 0.0122, longitudeDelta: 0.0121 }
      : DEFAULT_REGION
  );
  const [markerPosition, setMarkerPosition] = useState(
    initialLocation || DEFAULT_REGION
  );
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState<string>('');
  
  console.log('[LocationMapPicker] Current state:', {region, markerPosition, loading, address});

  useEffect(() => {
    console.log('[LocationMapPicker] Visible changed:', visible);
    if (visible) {
      console.log('[LocationMapPicker] Modal is visible, resetting map state');
      setAddress('');
      
      if (initialLocation) {
        console.log('[LocationMapPicker] Setting initial location:', initialLocation);
        const newRegion = {
          ...initialLocation,
          latitudeDelta: 0.0122,
          longitudeDelta: 0.0121,
        };
        setRegion(newRegion);
        setMarkerPosition(initialLocation);
        loadAddress(initialLocation.latitude, initialLocation.longitude);
      } else {
        console.log('[LocationMapPicker] No initial location, using default');
        setRegion(DEFAULT_REGION);
        setMarkerPosition(DEFAULT_REGION);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialLocation?.latitude, initialLocation?.longitude]);

  const loadAddress = useCallback(async (lat: number, lng: number) => {
    console.log('[LocationMapPicker] Loading address for:', {lat, lng});
    try {
      setLoading(true);
      const result = await geocodingService.reverseGeocode(lat, lng);
      if (result) {
        console.log('[LocationMapPicker] Address loaded:', result.formattedAddress);
        setAddress(result.formattedAddress);
      } else {
        console.warn('[LocationMapPicker] No result from reverse geocode');
      }
    } catch (error) {
      console.error('[LocationMapPicker] Error loading address:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMapPress = useCallback((event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    console.log('[LocationMapPicker] Map pressed:', {latitude, longitude});
    setMarkerPosition({ latitude, longitude });
    loadAddress(latitude, longitude);
  }, [loadAddress]);

  const handleConfirm = useCallback(async () => {
    try {
      setLoading(true);
      const result = await geocodingService.reverseGeocode(
        markerPosition.latitude,
        markerPosition.longitude
      );
      
      if (result) {
        onSelectLocation(result);
        onClose();
      }
    } catch (error) {
      console.error('[LocationMapPicker] Error confirming location:', error);
    } finally {
      setLoading(false);
    }
  }, [markerPosition, onSelectLocation, onClose]);

  const centerOnMarker = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        ...markerPosition,
        latitudeDelta: 0.0122,
        longitudeDelta: 0.0121,
      }, 500);
    }
  }, [markerPosition]);

  return (
    <Modal
      visible={visible}
       animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

        <View style={[styles.header, {backgroundColor: colors.surface}, {borderBottomColor: colors.border}]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="x" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: colors.text}]}>Select Location</Text>
          <View style={styles.closeButton} />
        </View>

        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={region}
            onPress={handleMapPress}
            showsUserLocation
            showsMyLocationButton
            showsCompass
          >
            <Marker
              coordinate={markerPosition}
              draggable
              onDragEnd={handleMapPress}
            >
              <View style={styles.customMarker}>
                <Icon name="map-pin" size={32} color={colors.accent} />
              </View>
            </Marker>
          </MapView>

          <TouchableOpacity
            style={[styles.centerButton, {backgroundColor: colors.surface}]}
            onPress={centerOnMarker}
            activeOpacity={0.7}
          >
            <Icon name="crosshair" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={[styles.footer, {borderTopColor: colors.border}]}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <>
              <View style={[styles.addressContainer, {backgroundColor: colors.surface}]}>
                <Icon name="map-pin" size={18} color={colors.accent} />
                <Text style={[styles.addressText, {color: colors.text}]} numberOfLines={2}>
                  {address || 'Tap on map to select location'}
                </Text>
              </View>
              <Button
                title="Confirm Location"
                onPress={handleConfirm}
                disabled={!address}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
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
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,

  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,

  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  customMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButton: {
    position: 'absolute',
    right: theme.spacing.md,
    bottom: theme.spacing.md,
    width: 48,
    height: 48,
    borderRadius: 24,

    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.md,
  },
  footer: {
    padding: theme.spacing.md,

    borderTopWidth: 1,

  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    padding: theme.spacing.sm,

    borderRadius: theme.borderRadius.md,
  },
  addressText: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: theme.fontSize.sm,

  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,

    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  mapLoadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,

  },
});
