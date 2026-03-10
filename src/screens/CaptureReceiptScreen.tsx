import React, {useState, useCallback, useRef, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Feather';
import {theme} from '../theme';
import {useTheme} from '../context/ThemeContext';
import {AnimatedPressable, ScreenHeader, ConfirmationModal} from '../components/ui';
import {
  recognizeTextFromImage,
  ocrResultToText,
  parseReceiptWithSanityCheck,
} from '../services/ocrService';
import {parseReceiptHybrid, isAIAvailable} from '../services/aiReceiptService';
import {analyzeReceiptWithTextract} from '../services/textractService';
import type {CaptureReceiptScreenProps} from '../types/navigation';
import type {OCRMethod} from '../types/index';

const TIPS = [
  {icon: 'sun', text: 'Good lighting'},
  {icon: 'crosshair', text: 'Keep in focus'},
  {icon: 'square', text: 'Full receipt'},
  {icon: 'eye-off', text: 'No shadows'},
];

export const CaptureReceiptScreen: React.FC<CaptureReceiptScreenProps> = ({
  navigation,
  route,
}) => {
  // Get existing items from ReviewItems (if adding more)
  const existingItems = useMemo(
    () => route.params?.existingItems || [],
    [route.params?.existingItems]
  );

  // OCR method - always use textract (AWS Textract is the standard)
  const [ocrMethod] = useState<OCRMethod>('textract');

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  // Modal states
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [pendingItems, setPendingItems] = useState<any[]>([]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setErrorModalVisible(true);
  }, []);

  const handleImageResponse = useCallback((response: ImagePickerResponse) => {
    if (response.didCancel) return;
    if (response.errorCode) {
      showError(response.errorMessage ?? 'Failed to capture image');
      return;
    }
    const uri = response.assets?.[0]?.uri;
    if (uri) setImageUri(uri);
  }, [showError]);

  const handleTakePhoto = useCallback(async () => {
    try {
      const response = await launchCamera({
        mediaType: 'photo',
        quality: 0.7,
        saveToPhotos: false,
        maxWidth: 1200,
        maxHeight: 1200,
      });
      handleImageResponse(response);
    } catch {
      showError('Failed to access camera');
    }
  }, [handleImageResponse, showError]);

  const handleChooseFromGallery = useCallback(async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.7,
        maxWidth: 1200,
        maxHeight: 1200,
      });
      handleImageResponse(response);
    } catch {
      showError('Failed to access gallery');
    }
  }, [handleImageResponse, showError]);

  const navigateToReview = useCallback((newItems: any[]) => {
    // Merge existing items with new items
    const mergedItems = [...existingItems, ...newItems];
    
    // Navigate back to ReviewItems (or create new one) with merged items
    // Use reset to avoid stacking multiple ReviewItems screens
    if (existingItems.length > 0) {
      // Pop back to ReviewItems and update with merged items
      navigation.navigate('ReviewItems', {items: mergedItems});
    } else {
      navigation.navigate('ReviewItems', {items: mergedItems});
    }
    setPendingItems([]);
  }, [navigation, existingItems]);

  const handleProcessReceipt = useCallback(async () => {
    if (!imageUri) {
      showError('Please capture or select a receipt first');
      return;
    }

    setIsProcessing(true);
    try {
      let itemsWithMetadata: any[] = [];

      // Route based on OCR method
      if (ocrMethod === 'textract') {
        // AWS Textract processing
        console.log('[Textract] Analyzing receipt...');
        const textractResult = await analyzeReceiptWithTextract(imageUri);

        if (!textractResult.items || textractResult.items.length === 0) {
          showError('Textract could not extract items. Try a clearer photo.');
          return;
        }

        itemsWithMetadata = textractResult.items;
        console.log(`[Textract] Extracted ${textractResult.items.length} items from ${textractResult.metadata.store}`);

        // Navigate directly (no sanity check for Textract)
        navigateToReview(itemsWithMetadata);
      } else {
        // ML Kit OCR processing (existing implementation)
        console.log('[ML Kit] Processing receipt...');
        const ocrResult = await recognizeTextFromImage(imageUri);
        if (!ocrResult || ocrResult.length === 0) {
          showError('Could not read text. Try a clearer photo.');
          return;
        }

        const fullText = ocrResultToText(ocrResult);
        console.log('[ML Kit] Recognized text:', fullText);

        // Use parser with sanity check
        let result = parseReceiptWithSanityCheck(fullText);
        let items = result.items;
        const metadata = result.metadata;
        const sanityCheck = result.sanityCheck;

        // Try AI if traditional parser found no items
        if (items.length === 0 && isAIAvailable()) {
          console.log('[ML Kit] Traditional parser found no items, trying AI...');
          items = await parseReceiptHybrid(fullText, (text) => parseReceiptWithSanityCheck(text).items);
        }

        if (items.length === 0) {
          showError('Could not extract items. Try a clearer photo.');
          return;
        }

        itemsWithMetadata = items.map(item => ({
          ...item,
          purchaseDate: metadata.date,
          store: metadata.store,
        }));

        // Show sanity check warning if there's a significant difference
        if (sanityCheck.receiptTotal > 0 && sanityCheck.difference > 5) {
          setPendingItems(itemsWithMetadata);
          setWarningMessage(sanityCheck.message);
          setWarningModalVisible(true);
        } else {
          navigateToReview(itemsWithMetadata);
        }
      }
    } catch (error) {
      console.error(`[${ocrMethod === 'textract' ? 'Textract' : 'ML Kit'}] Error:`, error);
      showError(`Failed to process receipt with ${ocrMethod === 'textract' ? 'AWS Textract' : 'ML Kit OCR'}.`);
    } finally {
      setIsProcessing(false);
    }
  }, [imageUri, ocrMethod, showError, navigateToReview]);

  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader 
        title="Scan Receipt" 
        subtitle="Capture or select image"
        onBack={() => navigation.goBack()}
      />
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        <Animated.View style={{opacity: fadeAnim}}>
          {imageUri ? (
            <View style={styles.previewContainer}>
              <View style={[styles.imageWrapper, {backgroundColor: colors.surface}]}>
                <Image
                  source={{uri: imageUri}}
                  style={styles.image}
                  resizeMode="contain"
                />
                {isProcessing && (
                  <View style={styles.processingOverlay}>
                    <ActivityIndicator size="large" color={colors.surface} />
                    <Text style={[styles.processingText, {color: colors.text}]}>
                      {ocrMethod === 'textract' ? 'Analyzing with AWS Textract...' : 'Processing with ML Kit...'}
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={styles.actionRow}>
                <AnimatedPressable 
                  style={[styles.actionButton, {backgroundColor: colors.surface}]} 
                  onPress={() => setImageUri(null)}
                  disabled={isProcessing}>
                  <Icon name="rotate-ccw" size={20} color={colors.text} />
                  <Text style={[styles.actionButtonText, {color: colors.text}]}>Retake</Text>
                </AnimatedPressable>
                
                <AnimatedPressable 
                  style={[styles.actionButton, styles.actionButtonPrimary, {backgroundColor: colors.accent}]} 
                  onPress={handleProcessReceipt}
                  disabled={isProcessing}>
                  <Icon name="check" size={20} color={colors.surface} />
                  <Text style={[styles.actionButtonTextPrimary, {color: colors.textLight}]}>Process</Text>
                </AnimatedPressable>
              </View>
            </View>
          ) : (
            <View style={styles.captureContainer}>
              <View style={[styles.placeholderBox, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                <Icon name="camera" size={48} color={colors.textSecondary} />
                <Text style={[styles.placeholderText, {color: colors.textSecondary}]}>No image selected</Text>
              </View>
              
              <View style={styles.captureActions}>
                <AnimatedPressable style={[styles.captureButton, {backgroundColor: colors.accent}]} onPress={handleTakePhoto}>
                  <Icon name="camera" size={22} color={colors.textLight} />
                  <Text style={[styles.captureButtonText, {color: colors.textLight}]}>Take Photo</Text>
                </AnimatedPressable>
                
                <AnimatedPressable style={[styles.galleryButton, {backgroundColor: colors.surface, borderColor: colors.accent}]} onPress={handleChooseFromGallery}>
                  <Icon name="image" size={22} color={colors.accent} />
                  <Text style={[styles.galleryButtonText, {color: colors.accent}]}>Gallery</Text>
                </AnimatedPressable>
              </View>
            </View>
          )}

          <View style={[styles.tipsCard, {backgroundColor: colors.surface}]}>
            <View style={styles.tipsHeader}>
              <Icon name="zap" size={16} color={colors.accent} />
              <Text style={[styles.tipsTitle, {color: colors.text}]}>Tips for best results</Text>
            </View>
            <View style={styles.tipsGrid}>
              {TIPS.map((tip, index) => (
                <View key={index} style={[styles.tipItem, {backgroundColor: colors.surface}]}>
                  <Icon name={tip.icon} size={16} color={colors.textSecondary} />
                  <Text style={[styles.tipText, {color: colors.text}]}>{tip.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Error Modal */}
      <ConfirmationModal
        visible={errorModalVisible}
        title="Error"
        message={errorMessage}
        icon="alert-circle"
        iconColor={colors.error}
        buttons={[
          {text: 'OK', onPress: () => setErrorModalVisible(false)},
        ]}
      />

      {/* Sanity Check Warning Modal */}
      <ConfirmationModal
        visible={warningModalVisible}
        title="Verify Items"
        message={warningMessage}
        icon="alert-triangle"
        iconColor={colors.warning}
        buttons={[
          {
            text: 'Review Anyway',
            onPress: () => {
              setWarningModalVisible(false);
              navigateToReview(pendingItems);
            },
          },
          {
            text: 'Retake Photo',
            onPress: () => {
              setWarningModalVisible(false);
              setImageUri(null);
              setPendingItems([]);
            },
            style: 'cancel',
          },
        ]}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },

  // Method Selector
  methodSelector: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    ...theme.shadow.sm,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  methodTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  methodToggle: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  methodOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,

    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,

  },
  methodOptionActive: {
  },
  methodOptionText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,

  },
  methodOptionTextActive: {

    fontWeight: theme.fontWeight.semibold,
  },
  methodDescription: {
    fontSize: theme.fontSize.xs,

    textAlign: 'center',
    lineHeight: 16,
  },

  // Preview mode
  previewContainer: {
    marginBottom: theme.spacing.lg,
  },
  imageWrapper: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',

    ...theme.shadow.md,
  },
  image: {
    width: '100%',
    height: 320,

  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {

    fontSize: theme.fontSize.md,
    marginTop: theme.spacing.md,
    fontWeight: theme.fontWeight.medium,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,

    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    ...theme.shadow.sm,
  },
  actionButtonPrimary: {
  },
  actionButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  actionButtonTextPrimary: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  
  // Capture mode
  captureContainer: {
    marginBottom: theme.spacing.lg,
  },
  placeholderBox: {
    height: 240,

    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,

    borderStyle: 'dashed',
    marginBottom: theme.spacing.md,
  },
  placeholderText: {
    fontSize: theme.fontSize.md,

    marginTop: theme.spacing.md,
  },
  captureActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,

    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    ...theme.shadow.sm,
  },
  captureButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  galleryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,

    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,

  },
  galleryButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  
  // Tips
  tipsCard: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  tipsTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  tipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tipItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  tipText: {
    fontSize: theme.fontSize.sm,

  },
});
