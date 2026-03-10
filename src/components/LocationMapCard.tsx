import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';

interface LocationMapCardProps {
  latitude: number;
  longitude: number;
  address?: string;
  cityState?: string;
  height?: number;
  showOpenInMaps?: boolean;
  interactive?: boolean;
  onPress?: () => void;
}

export const LocationMapCard: React.FC<LocationMapCardProps> = ({
  latitude,
  longitude,
  address = '',
  cityState = '',
  height = 200,
  showOpenInMaps = true,
  interactive = true,
  onPress,
}) => {
  const {colors} = useTheme();
  const handleOpenInMaps = useCallback(() => {
    const url = Platform.select({
      ios: `maps:?q=${latitude},${longitude}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${address})`,
    });
    console.log('[LocationMapCard] Opening maps with URL:', url);
    Linking.openURL(url!).catch((err) => {
      console.error('[LocationMapCard] Error opening maps:', err);
      Alert.alert('Error', 'Could not open maps');
    });
  }, [latitude, longitude, address]);

  if (!latitude || !longitude) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={[styles.mapContainer, {backgroundColor: colors.surface}, styles.noMapPlaceholder]}>
          <Icon name="alert-circle" size={40} color={colors.textSecondary} />
          <Text style={[styles.noMapText, {color: colors.textSecondary}]}>No coordinates available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity         style={[styles.mapContainer, {backgroundColor: colors.surface}, { height }]}
        onPress={onPress}
        activeOpacity={onPress ? 0.9 : 1}
        disabled={!onPress}
      >
        <MapView
          key={`map-${latitude}-${longitude}`}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          region={{
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          scrollEnabled={interactive}
          zoomEnabled={interactive}
          pitchEnabled={false}
          rotateEnabled={false}
          showsUserLocation={false}
          showsMyLocationButton={false}
          loadingEnabled={true}
          loadingIndicatorColor={colors.accent}
          loadingBackgroundColor="#ffffff"
        >
          <Marker
            coordinate={{ latitude, longitude }}
            title={address}
            description={cityState}
          />
        </MapView>
      </TouchableOpacity>

      {showOpenInMaps && (
        <TouchableOpacity
          style={[styles.openMapsButton, {backgroundColor: `${colors.accent}15`}]}
          onPress={handleOpenInMaps}
          activeOpacity={0.7}
        >
          <Icon name="external-link" size={16} color={colors.accent} />
          <Text style={[styles.openMapsButtonText, {color: colors.accent}]}>Open in Maps</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: theme.spacing.sm,
  },
  mapContainer: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',

  },
  map: {
    width: '100%',
    height: '100%',
  },
  noMapPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noMapText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.fontSize.sm,

  },
  openMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,

    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  openMapsButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

  },
});
