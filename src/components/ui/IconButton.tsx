import React, {useCallback} from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
  Animated,
} from 'react-native';
import {theme} from '../../theme';
import {useTheme} from '../../context/ThemeContext';

interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'filled' | 'outlined';
  disabled?: boolean;
  style?: ViewStyle;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  size = 'md',
  variant = 'default',
  disabled = false,
  style,
}) => {
  const {colors} = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const sizeValue = size === 'sm' ? 36 : size === 'lg' ? 52 : 44;

  return (
    <Animated.View style={{transform: [{scale: scaleAnim}]}}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.8}
        style={[
          styles.base,
          {width: sizeValue, height: sizeValue, borderRadius: sizeValue / 2, backgroundColor: colors.background},
          variant === 'filled' && styles.filled,
          variant === 'outlined' && [styles.outlined, {borderColor: colors.border}],
          disabled && styles.disabled,
          style,
        ]}>
        {icon}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',

  },
  filled: {
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,

  },
  disabled: {
    opacity: 0.4,
  },
});
