import React, {useCallback, useRef, useEffect} from 'react';
import {View, Text, StyleSheet, SafeAreaView, ScrollView, Animated} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import {AnimatedPressable, ScreenHeader} from '../components/ui';
import type {AddInventoryScreenProps} from '../types/navigation';

// Selection Card Component
interface SelectionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onPress: () => void;
  featured?: boolean;
}

const SelectionCard: React.FC<SelectionCardProps> = ({
  title,
  description,
  icon,
  onPress,
  featured = false,
}) => {
  const { colors } = useTheme();
  return (
  <AnimatedPressable 
    style={[styles.card, {backgroundColor: colors.surface}, featured && {borderWidth: 1.5, borderColor: colors.accent}]} 
    onPress={onPress}
  >
    <View style={[styles.iconContainer, {backgroundColor: colors.background}, featured && {backgroundColor: colors.accent}]}>
      {icon}
    </View>
    <View style={styles.cardContent}>
      <Text style={[styles.cardTitle, {color: colors.text}]}>{title}</Text>
      <Text style={[styles.cardDescription, {color: colors.textSecondary}]}>{description}</Text>
    </View>
    <Icon name="chevron-right" size={20} color={colors.textSecondary} />
  </AnimatedPressable>
  );
};

export const AddInventoryScreen: React.FC<AddInventoryScreenProps> = ({
  navigation,
  route,
}) => {
  // Get existing items from ReviewItems (if adding more)
  const existingItems = route.params?.existingItems;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Always use AWS Textract as default OCR method
  const ocrMethod: 'textract' = 'textract';

  const { colors } = useTheme();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleCaptureReceipt = useCallback(() => {
    navigation.navigate('CaptureReceipt', {existingItems, ocrMethod});
  }, [navigation, existingItems, ocrMethod]);

  const handleManualEntry = useCallback(() => {
    navigation.navigate('ManualEntry', {existingItems});
  }, [navigation, existingItems]);

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <ScreenHeader 
        title="Add Materials" 
        subtitle="Choose input method"
        onBack={() => navigation.goBack()}
      />
      
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        
        <Animated.View style={{opacity: fadeAnim}}>
          <View style={styles.cardsContainer}>
            <SelectionCard
              title="Scan Receipt"
              description="Automatically extract materials using camera OCR"
              icon={<Icon name="file-text" size={22} color={colors.surface} />}
              onPress={handleCaptureReceipt}
              featured
            />

            <SelectionCard
              title="Manual Entry"
              description="Enter item details by hand"
              icon={<Icon name="edit-3" size={22} color={colors.accent} />}
              onPress={handleManualEntry}
            />
          </View>

          <View style={[styles.tipContainer, {backgroundColor: colors.surface}]}>
            <View style={[styles.tipIconWrap, {backgroundColor: colors.successLight}]}>
              <Icon name="zap" size={16} color={colors.accent} />
            </View>
            <Text style={[styles.tipText, {color: colors.textSecondary}]}>
              For best results, ensure receipts are flat and well-lit before scanning.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  cardsContainer: {
    gap: theme.spacing.sm,
  },
  card: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...theme.shadow.sm,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: 2,
  },
  cardDescription: {
    fontSize: theme.fontSize.sm,
    lineHeight: 18,
  },
  tipContainer: {
    marginTop: theme.spacing.xl,
    flexDirection: 'row',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    ...theme.shadow.sm,
  },
  tipIconWrap: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  tipText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
  },
});
