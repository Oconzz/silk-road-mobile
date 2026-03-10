import React from 'react';
import {View, StyleSheet, type ViewStyle} from 'react-native';
import {theme} from '../../theme';
import {useTheme} from '../../context/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'default',
  padding = 'md',
}) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: colors.surface },
        variant === 'elevated' && styles.elevated,
        variant === 'outlined' && [styles.outlined, { borderColor: colors.border }],
        padding !== 'none' && styles[`padding_${padding}`],
        style,
      ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {

    borderRadius: theme.borderRadius.lg,
    ...theme.shadow.sm,
  },
  elevated: {
    ...theme.shadow.md,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1,

    shadowOpacity: 0,
    elevation: 0,
  },
  padding_sm: {
    padding: theme.spacing.sm,
  },
  padding_md: {
    padding: theme.spacing.md,
  },
  padding_lg: {
    padding: theme.spacing.lg,
  },
});
