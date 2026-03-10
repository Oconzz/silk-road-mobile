import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {theme} from '../../theme';
import {useTheme} from '../../context/ThemeContext';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  /** Custom title component (replaces default title text) */
  titleComponent?: React.ReactNode;
  /** Non-interactive tag/badge displayed between title and rightAction */
  tag?: React.ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightAction,
  titleComponent,
  tag,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.leftSection}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}
            activeOpacity={0.6}>
            <View style={[styles.backIconWrap, { backgroundColor: `${colors.text}08` }]}>
              <Icon name="arrow-left" size={20} color={colors.text} />
            </View>
          </TouchableOpacity>
        )}
        <View style={styles.titleContainer}>
          {titleComponent ? (
            titleComponent
          ) : (
            <>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {title}
              </Text>
              {subtitle && (
                <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </>
          )}
        </View>
      </View>
      {tag && <View style={styles.tagSection}>{tag}</View>}
      {rightAction && <View style={styles.rightSection}>{rightAction}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,

  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: theme.spacing.sm,
  },
  backIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,

    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,

    marginTop: 2,
  },
  rightSection: {
    marginLeft: theme.spacing.md,
  },
  tagSection: {
    marginHorizontal: theme.spacing.sm,
  },
});
