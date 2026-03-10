import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TAB_ICONS: Record<string, string> = {
  HomeTab: 'home',
  JobsTab: 'briefcase',
  EstimatesTab: 'file-text',
  InventoryTab: 'package',
  TimeCardsTab: 'clock',
};

const TAB_LABELS: Record<string, string> = {
  HomeTab: 'Home',
  JobsTab: 'Jobs',
  EstimatesTab: 'Estimates',
  InventoryTab: 'Inventory',
  TimeCardsTab: 'Time Cards',
};

export const CustomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const scaleAnims = useRef(state.routes.map(() => new Animated.Value(1))).current;
  
  const tabWidth = (SCREEN_WIDTH - 32) / state.routes.length;

  useEffect(() => {
    // Animate indicator with spring
    Animated.spring(indicatorAnim, {
      toValue: state.index * tabWidth,
      useNativeDriver: true,
      tension: 68,
      friction: 10,
    }).start();

    // Animate active tab scale
    scaleAnims.forEach((anim, index) => {
      Animated.spring(anim, {
        toValue: index === state.index ? 1.15 : 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    });
  }, [state.index, indicatorAnim, scaleAnims, tabWidth]);

  const handleTabPress = (route: any, index: number, isFocused: boolean) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const handleTabLongPress = (route: any) => {
    navigation.emit({
      type: 'tabLongPress',
      target: route.key,
    });
  };

  const { colors } = useTheme();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={[styles.tabBar, { backgroundColor: colors.surface }]}>
        {/* Animated Indicator */}
        <Animated.View
          style={[
            styles.indicator,
            {
              width: tabWidth - 8,
              backgroundColor: `${colors.accent}15`,
              transform: [{ translateX: Animated.add(indicatorAnim, new Animated.Value(4)) }],
            },
          ]}
        />

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const iconName = TAB_ICONS[route.name] || 'circle';
          const label = TAB_LABELS[route.name] || options.tabBarLabel || route.name;

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={() => handleTabPress(route, index, isFocused)}
              onLongPress={() => handleTabLongPress(route)}
              style={styles.tab}
              activeOpacity={0.7}
            >
              <Animated.View
                style={[
                  styles.tabContent,
                  { transform: [{ scale: scaleAnims[index] }] },
                ]}
              >
                <Icon
                  name={iconName}
                  size={22}
                  color={isFocused ? colors.accent : colors.gray}
                />
                <Text
                  style={[
                    styles.label,
                    { color: isFocused ? colors.accent : colors.gray },
                    isFocused && styles.labelActive,
                  ]}
                  numberOfLines={1}
                >
                  {typeof label === 'string' ? label : route.name}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  tabBar: {
    flexDirection: 'row',

    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  labelActive: {
    fontWeight: '700',
  },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,

    borderRadius: 20,
  },
});

export default CustomTabBar;
