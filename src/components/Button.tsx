import React, {memo, useMemo} from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
} from 'react-native';
import {theme} from '../theme';
import {useTheme} from '../context/ThemeContext';

type ButtonVariant = 'primary' | 'secondary' | 'outline';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button = memo<ButtonProps>(
  ({
    title,
    onPress,
    variant = 'primary',
    disabled = false,
    loading = false,
    style,
    textStyle,
  }) => {
    const {colors} = useTheme();
    const buttonStyle = useMemo((): StyleProp<ViewStyle> => {
      const variantStyles: Record<ButtonVariant, ViewStyle> = {
        primary: { backgroundColor: colors.accent },
        secondary: { ...styles.secondaryButton, backgroundColor: colors.surface, borderColor: colors.accent },
        outline: { ...styles.outlineButton, borderColor: colors.accent },
      };

      return [
        styles.button,
        variantStyles[variant],
        disabled && styles.disabled,
        style,
      ];
    }, [variant, disabled, style, colors]);

    const labelStyle = useMemo((): StyleProp<TextStyle> => {
      const variantStyles: Record<ButtonVariant, TextStyle> = {
        primary: { color: colors.textLight },
        secondary: { color: colors.accent },
        outline: { color: colors.accent },
      };

      return [styles.text, variantStyles[variant], textStyle];
    }, [variant, textStyle, colors]);

    const indicatorColor = useMemo(
      () => (variant === 'primary' ? colors.textLight : colors.text),
      [variant, colors],
    );

    const isDisabled = disabled || loading;

    return (
      <TouchableOpacity
        style={buttonStyle}
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{disabled: isDisabled}}>
        {loading ? (
          <ActivityIndicator color={indicatorColor} size="small" />
        ) : (
          <Text style={labelStyle}>{title}</Text>
        )}
      </TouchableOpacity>
    );
  },
);

Button.displayName = 'Button';

const styles = StyleSheet.create({
  button: {

    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryButton: {

    borderWidth: 2,

  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,

  },
  text: {

    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  secondaryText: {
  },
  outlineText: {
  },
  disabled: {
    opacity: 0.5,
  },
});
