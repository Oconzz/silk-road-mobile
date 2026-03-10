import React, {useState, useEffect, useCallback, useMemo, memo, useRef} from 'react';
import {View, Text, StyleSheet, SafeAreaView, ActivityIndicator, Modal} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
  type Code,
  type CodeType,
} from 'react-native-vision-camera';
import {Button} from '../components/Button';
import {ScanResultModal, ConfirmationModal} from '../components/ui';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import {useInventory} from '../context/InventoryContext';
import {barcodeLookupService, type ProductInfo} from '../services/barcodeLookupService';
import type {BarcodeScannerScreenProps, InventoryItem} from '../types/navigation';

const SUPPORTED_CODE_TYPES: CodeType[] = [
  'qr',
  'ean-13',
  'ean-8',
  'upc-a',
  'upc-e',
  'code-128',
  'code-39',
  'code-93',
  'codabar',
  'itf',
  'pdf-417',
];

interface ScanOverlayProps {
  onCancel: () => void;
}

const ScanOverlay = memo<ScanOverlayProps>(({onCancel}) => {
  const {colors} = useTheme();
  return (
  <View style={styles.overlay}>
    <View style={styles.topOverlay}>
      <Text style={[styles.instructionText, {color: colors.text}]}>
        Position barcode within the frame
      </Text>
    </View>

    <View style={styles.middleRow}>
      <View style={styles.sideOverlay} />
      <View style={styles.scanArea}>
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />
      </View>
      <View style={styles.sideOverlay} />
    </View>

    <View style={styles.bottomOverlay}>
      <Button
        title="Cancel"
        onPress={onCancel}
        variant="secondary"
        style={styles.cancelButton}
      />
    </View>
  </View>
  );
});

ScanOverlay.displayName = 'ScanOverlay';

interface PermissionScreenProps {
  onRequestPermission: () => void;
}

const PermissionScreen = memo<PermissionScreenProps>(({onRequestPermission}) => {
  const {colors} = useTheme();
  return (
  <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
    <View style={styles.content}>
      <Text style={[styles.title, {color: colors.text}]}>Camera Permission Required</Text>
      <Text style={[styles.description, {color: colors.textSecondary}]}>
        Please grant camera permission to scan barcodes
      </Text>
      <Button
        title="Request Permission"
        onPress={onRequestPermission}
        style={styles.button}
      />
    </View>
  </SafeAreaView>
  );
});

PermissionScreen.displayName = 'PermissionScreen';

const NoCameraScreen = memo(() => {
  const {colors} = useTheme();
  return (
  <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
    <View style={styles.content}>
      <Text style={[styles.title, {color: colors.text}]}>No Camera Found</Text>
      <Text style={[styles.description, {color: colors.textSecondary}]}>Unable to access camera device</Text>
    </View>
  </SafeAreaView>
  );
});

NoCameraScreen.displayName = 'NoCameraScreen';

interface ScanResult {
  code: string;
  type: string;
  product?: ProductInfo;
  existingItem?: InventoryItem;
}

export const BarcodeScannerScreen: React.FC<BarcodeScannerScreenProps> = ({
  route,
  navigation,
}) => {
  const { colors } = useTheme();
  const [hasPermission, setHasPermission] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [showExistingItemModal, setShowExistingItemModal] = useState(false);
  const isProcessingRef = useRef(false);
  const device = useCameraDevice('back');
  
  const { items } = useInventory();
  const context = route.params?.context || 'inventory';

  useEffect(() => {
    const checkPermission = async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    };
    checkPermission();
  }, []);

  const handleCodeScanned = useCallback(
    async (codes: Code[]) => {
      if (codes.length === 0 || showModal || isProcessingRef.current || isLookingUp) {
        return;
      }

      const code = codes[0];
      if (code.value) {
        isProcessingRef.current = true;
        setIsLookingUp(true);
        
        console.log('[BarcodeScanner] Scanned:', code.value);
        
        // Check if barcode already exists in inventory
        const existingItem = items.find(item => item.barcode === code.value);
        
        // Lookup product info from Go-UPC
        let product: ProductInfo | undefined;
        try {
          const result = await barcodeLookupService.lookupBarcode(code.value);
          if (result.success && result.product) {
            product = result.product;
            console.log('[BarcodeScanner] Product found:', product.name);
          }
        } catch (error) {
          console.error('[BarcodeScanner] Lookup error:', error);
        }
        
        setIsLookingUp(false);
        
        if (existingItem && context === 'inventory') {
          // Barcode exists - show modal to add quantity
          setScanResult({
            code: code.value,
            type: code.type,
            product,
            existingItem,
          });
          setShowExistingItemModal(true);
        } else {
          // New barcode - show standard modal
          setScanResult({
            code: code.value,
            type: code.type,
            product,
          });
          setShowModal(true);
        }
      }
    },
    [showModal, isLookingUp, items, context],
  );

  const handleUseCode = useCallback(() => {
    if (isProcessingRef.current === false || !scanResult) {
      return;
    }
    setShowModal(false);
    
    // If context is inventory, navigate to ManualEntry with product info
    if (context === 'inventory' && scanResult.product) {
      navigation.replace('ManualEntry', {
        barcode: scanResult.code,
        productName: scanResult.product.name,
        productDescription: scanResult.product.description,
        productBrand: scanResult.product.brand,
        productCategory: scanResult.product.category,
        productImageUrl: scanResult.product.imageUrl,
      });
    } else {
      // Call callback for other contexts
      route.params.onScan(scanResult.code);
    }
  }, [scanResult, route.params, context, navigation]);

  const handleGoToExistingItem = useCallback(() => {
    if (!scanResult?.existingItem) return;
    setShowExistingItemModal(false);
    
    // Navigate to inventory and trigger add quantity modal
    navigation.replace('MainTabs', {
      screen: 'InventoryTab',
      params: {
        openAddQtyForItemId: scanResult.existingItem.id,
      },
    } as any);
  }, [scanResult, navigation]);

  const handleAddAsNew = useCallback(() => {
    if (!scanResult) return;
    setShowExistingItemModal(false);
    
    // Navigate to ManualEntry with product info
    navigation.replace('ManualEntry', {
      barcode: scanResult.code,
      productName: scanResult.product?.name,
      productDescription: scanResult.product?.description,
      productBrand: scanResult.product?.brand,
      productCategory: scanResult.product?.category,
      productImageUrl: scanResult.product?.imageUrl,
    });
  }, [scanResult, navigation]);

  const handleScanAgain = useCallback(() => {
    setShowModal(false);
    setShowExistingItemModal(false);
    setScanResult(null);
    isProcessingRef.current = false;
  }, []);

  const codeScanner = useCodeScanner({
    codeTypes: SUPPORTED_CODE_TYPES,
    onCodeScanned: handleCodeScanned,
  });

  const handleRequestPermission = useCallback(async () => {
    const status = await Camera.requestCameraPermission();
    setHasPermission(status === 'granted');
  }, []);

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const isActive = useMemo(() => !showModal, [showModal]);

  if (!hasPermission) {
    return <PermissionScreen onRequestPermission={handleRequestPermission} />;
  }

  if (!device) {
    return <NoCameraScreen />;
  }

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: colors.background}]}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        codeScanner={codeScanner}
      />
      <ScanOverlay onCancel={handleCancel} />
      
      {/* Loading Modal */}
      <Modal visible={isLookingUp} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, {color: colors.text}]}>Looking up product...</Text>
          </View>
        </View>
      </Modal>
      
      {/* Standard Scan Result Modal */}
      <ScanResultModal
        visible={showModal}
        code={scanResult?.code ?? ''}
        codeType={scanResult?.type ?? ''}
        productName={scanResult?.product?.name}
        productDescription={scanResult?.product?.description}
        onUseCode={handleUseCode}
        onScanAgain={handleScanAgain}
      />
      
      {/* Existing Item Modal */}
      <ConfirmationModal
        visible={showExistingItemModal}
        title="Item Already Exists"
        message={`"${scanResult?.existingItem?.name}" is already in your inventory with ${scanResult?.existingItem?.quantity} units. Would you like to add more quantity or create a new item?`}
        icon="package"
        iconColor={colors.accent}
        buttons={[
          { text: 'Add Quantity', onPress: handleGoToExistingItem },
          { text: 'Create New', onPress: handleAddAsNew, style: 'cancel' },
          { text: 'Scan Again', onPress: handleScanAgain, style: 'cancel' },
        ]}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,

  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,

    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  description: {
    fontSize: theme.fontSize.md,

    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  button: {
    minWidth: 200,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionText: {

    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  middleRow: {
    flexDirection: 'row',
    height: 250,
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scanArea: {
    width: 300,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,

  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: theme.spacing.xxl,
  },
  cancelButton: {
    minWidth: 200,
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    minWidth: 200,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

  },
});
