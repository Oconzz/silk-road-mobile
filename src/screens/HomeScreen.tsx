import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Dimensions,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { inventoryService } from '../services/api/domain/inventory/inventoryService';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../context/ThemeContext';
import { useEstimate } from '../context/EstimateContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions, PermissionKeys } from '../context/PermissionContext';
import { AnimatedPressable } from '../components/ui';
// import { AssignedJobsCard } from '../components/AssignedJobsCard';
import { ClockInOutWidget } from '../components/ClockInOutWidget';
import type { RootStackParamList } from '../types/navigation';

const { width, height } = Dimensions.get('window');

// Responsive calculations
const isSmallDevice = height < 700; // iPhone SE, etc
const CARD_GAP = isSmallDevice ? 10 : 16; 
const HORIZONTAL_PADDING = isSmallDevice ? 16 : 24;
const CARD_WIDTH = (width - (HORIZONTAL_PADDING * 2) - CARD_GAP) / 2;
const CARD_HEIGHT = isSmallDevice ? 90 : 110;

interface DashboardActionProps {
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
  variant?: 'primary' | 'neutral';
}

const DashboardAction: React.FC<DashboardActionProps> = ({
  title,
  subtitle,
  icon,
  onPress,
  variant = 'neutral',
}) => {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  
  return (
    <AnimatedPressable
      style={[
        styles.actionCard, 
        isPrimary 
          ? [styles.actionCardPrimary, { backgroundColor: colors.accent }] 
          : [styles.actionCardNeutral, { backgroundColor: colors.surface, borderColor: colors.divider }]
      ]}
      onPress={onPress}
    >
      <View style={[
        styles.iconContainer, 
        isPrimary 
          ? styles.iconContainerPrimary 
          : [styles.iconContainerNeutral, { backgroundColor: colors.background }]
      ]}>
        <Icon 
          name={icon} 
          size={isSmallDevice ? 18 : 22} 
          color={isPrimary ? '#FFFFFF' : colors.text} 
        />
      </View>
      <View>
        <Text style={[styles.actionTitle, isPrimary ? styles.textWhite : { color: colors.text }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.actionSubtitle, isPrimary ? styles.textWhiteOpacity : { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>
    </AnimatedPressable>
  );
};

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { initDraft } = useEstimate();
  const { currentCompany } = useAuth();
  const { hasPermission } = usePermissions();
  
  const isAdmin = currentCompany?.role === 'Admin' || currentCompany?.role === 'SuperAdmin';
  
  // Stats from backend (covers all warehouses)
  const [totalValue, setTotalValue] = useState<number>(0);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [amountSaved, setAmountSaved] = useState<number>(0);

  // Load inventory stats when screen is focused
  const loadStats = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const stats = await inventoryService.getStats();
      setTotalValue(stats.totalValue);
      setTotalItems(stats.totalItems);
      setAmountSaved(stats.amountSaved);
    } catch (error) {
      console.error('Failed to load inventory stats:', error);
    }
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  // Animação sutil de entrada
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const TAB_BAR_FIXED_CONTENT = 74; // tab bar inner content height (icons + labels + padding)
  const TAB_BAR_TOTAL = TAB_BAR_FIXED_CONTENT + Math.max(insets.bottom, 8); // actual tab bar height on this device
  const CONTENT_GAP = 16; // fixed gap between last card and tab bar — same on ALL devices
  const bottomPadding = TAB_BAR_TOTAL + CONTENT_GAP;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      <View style={[styles.content, { paddingBottom: bottomPadding }]}>
        {/* Header Clean */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View>
              <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>Welcome to</Text>
              <Text style={[styles.appTitle, { color: colors.text }]}>Silk Road</Text>
            </View>
            <TouchableOpacity 
              style={[styles.profileButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('Settings')}>
               <Icon name="settings" size={20} color={colors.text} />
            </TouchableOpacity>
          </Animated.View>

          {/* Main Stats Card - Shows Inventory for Admin, Jobs for Contractors */}
          <Animated.View style={[styles.statsWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {isAdmin ? (
              <View style={[styles.mainCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.mainCardTop}>
                  <View>
                    <Text style={[styles.labelMoney, { color: colors.textSecondary }]}>Total Inventory Value</Text>
                    <Text style={[styles.valueMoney, { color: colors.text }]}>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue)}
                    </Text>
                  </View>
                  <View style={[styles.trendIcon, { backgroundColor: colors.successLight }]}>
                    <Icon name="trending-up" size={20} color={colors.success} />
                  </View>
                </View>
                
                <View style={[styles.divider, { backgroundColor: colors.divider }]} />

                <View style={styles.mainCardBottom}>
                  <View style={styles.statCol}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total SKUs</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{totalItems}</Text>
                  </View>
                  <View style={[styles.verticalSep, { backgroundColor: colors.divider }]} />
                  <View style={styles.statCol}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Amount Saved</Text>
                    <Text style={[styles.statValue, styles.savedValue, { color: colors.success }]}>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amountSaved)}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.staffDashboard}>
                {/* Time Tracking Widget for Staff */}
                <ClockInOutWidget 
                  onViewHistory={() => navigation.navigate('TimeCards')}
                  compact={false}
                />
              </View>
            )}
          </Animated.View>

          {/* Grid Action Area */}
          <Animated.View style={[styles.gridContainer, { opacity: fadeAnim }]}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Actions</Text>
            
            <View style={styles.grid}>
              {isAdmin ? (
                <>
                  {/* Admin Actions */}
                  <DashboardAction
                    title="New Estimate"
                    subtitle="Create and share"
                    icon="file-plus"
                    variant="primary"
                    onPress={() => {
                      initDraft();
                      navigation.navigate('CreateEstimate');
                    }}
                  />

                  <DashboardAction
                    title="Scan Receipt"
                    subtitle="Extract materials"
                    icon="camera"
                    onPress={() => navigation.navigate('CaptureReceipt')}
                  />

                  <DashboardAction
                    title="Team"
                    subtitle="Manage members"
                    icon="users"
                    onPress={() => navigation.navigate('TeamMembers')}
                  />

                  <DashboardAction
                    title="Manual Entry"
                    subtitle="Add Material"
                    icon="edit-3"
                    onPress={() => navigation.navigate('ManualEntry')}
                  />

                  <DashboardAction
                    title="Templates"
                    subtitle="Jobs & Estimates"
                    icon="layout"
                    onPress={() => navigation.navigate('TemplatesList')}
                  />

                  <DashboardAction
                    title="Clients"
                    subtitle="View & Add"
                    icon="users"
                    onPress={() => navigation.navigate('ClientsList')}
                  />
                </>
              ) : (
                <>
                  {/* Staff Actions - Permission Based */}
                  {hasPermission(PermissionKeys.CreateEstimates) && (
                    <DashboardAction
                      title="New Estimate"
                      subtitle="Create and share"
                      icon="file-plus"
                      variant="primary"
                      onPress={() => {
                        initDraft();
                        navigation.navigate('CreateEstimate');
                      }}
                    />
                  )}

                  {hasPermission(PermissionKeys.ManageInventory) && (
                    <DashboardAction
                      title="Scan Receipt"
                      subtitle="Extract materials"
                      icon="camera"
                      onPress={() => navigation.navigate('CaptureReceipt')}
                    />
                  )}

                  {hasPermission(PermissionKeys.ManageInventory) && (
                    <DashboardAction
                      title="Manual Entry"
                      subtitle="Add Material"
                      icon="edit-3"
                      onPress={() => navigation.navigate('ManualEntry')}
                    />
                  )}

                  {hasPermission(PermissionKeys.ViewClients) && (
                    <DashboardAction
                      title="Clients"
                      subtitle="View clients"
                      icon="users"
                      onPress={() => navigation.navigate('ClientsList')}
                    />
                  )}
                </>
              )}
            </View>
          </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: isSmallDevice ? 6 : 10,
    paddingBottom: 0,
  },

  // --- Header ---
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: isSmallDevice ? 12 : 20,
    marginTop: Platform.OS === 'android' ? 10 : 0,
  },
  dateLabel: {
    fontSize: 13,
    // color via colors.textSecondary inline
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
    marginBottom: 4,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800', // Heavy bold
    // color via colors.text inline
    letterSpacing: -1,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    // backgroundColor via colors.surface inline
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    // borderColor via colors.border inline
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },

  // --- Main Stats Card ---
  statsWrapper: {
    marginBottom: isSmallDevice ? 8 : 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  mainCard: {
    // backgroundColor via colors.surface inline
    borderRadius: isSmallDevice ? 16 : 20,
    padding: isSmallDevice ? 16 : 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  mainCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: isSmallDevice ? 12 : 20,
  },
  labelMoney: {
    fontSize: isSmallDevice ? 12 : 14,
    // color via colors.textSecondary inline
    marginBottom: 4,
    fontWeight: '500',
  },
  valueMoney: {
    fontSize: isSmallDevice ? 26 : 34,
    fontWeight: '800',
    // color via colors.text inline
    letterSpacing: -1.5,
  },
  trendIcon: {
    // backgroundColor via colors.successLight inline
    padding: 8,
    borderRadius: 12,
  },
  divider: {
    height: 1,
    // backgroundColor via colors.divider inline
    marginBottom: isSmallDevice ? 10 : 16,
  },
  mainCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
  },
  verticalSep: {
    width: 1,
    height: 30,
    // backgroundColor via colors.divider inline
    marginHorizontal: 16,
  },
  statLabel: {
    fontSize: 12,
    // color via colors.textSecondary inline
    marginBottom: 4,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    // color via colors.text inline
  },
  savedValue: {
    // color via colors.success inline
  },

  // --- Action Grid ---
  gridContainer: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: isSmallDevice ? 16 : 18,
    fontWeight: '700',
    // color via colors.text inline
    marginBottom: isSmallDevice ? 10 : 16,
    letterSpacing: -0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    justifyContent: 'space-between', 
  },
  
  // --- Action Button Styles ---
  actionCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: isSmallDevice ? 14 : 18,
    padding: isSmallDevice ? 12 : 16,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  actionCardNeutral: {
    // backgroundColor via colors.surface inline
    borderWidth: 1,
    // borderColor via colors.divider inline
  },
  actionCardPrimary: {
    // backgroundColor via colors.text inline
    borderWidth: 0,
  },
  
  // Icons
  iconContainer: {
    width: isSmallDevice ? 32 : 40,
    height: isSmallDevice ? 32 : 40,
    borderRadius: isSmallDevice ? 10 : 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerNeutral: {
    // backgroundColor via colors.background inline
  },
  iconContainerPrimary: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Texts
  actionTitle: {
    fontSize: isSmallDevice ? 13 : 15,
    fontWeight: '600',
    // color via colors.text inline
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: isSmallDevice ? 10 : 12,
    fontWeight: '400',
  },
  textGrey: {
    // color via colors.textSecondary inline
  },
  textWhite: {
    color: '#FFFFFF',
  },
  textWhiteOpacity: {
    color: 'rgba(255,255,255,0.7)',
  },
  
  // Staff Dashboard
  staffDashboard: {
    gap: 16,
  },
});