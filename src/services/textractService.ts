/**
 * Textract Service - Frontend Integration
 * Handles AWS Textract receipt analysis directly from the mobile app
 *
 * Previously: Called backend API endpoint /receipts/analyze-textract
 * Now: Calls AWS Textract directly using AWS SDK
 */

// Declare atob as global (available in React Native runtime)
declare const atob: (data: string) => string;

import type {InventoryItem} from '../types/navigation';
import {analyzeReceiptAsync} from './aws/textractClient';
import * as RNFS from 'react-native-fs';

// Maximum image size allowed for Textract (in MB)
const MAX_IMAGE_SIZE_MB = 10;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

/**
 * Analyze receipt using AWS Textract (direct API call)
 * @param imageUri - Local file URI of the receipt image
 * @returns Parsed receipt data as InventoryItem array
 */
export const analyzeReceiptWithTextract = async (
  imageUri: string,
): Promise<{
  items: InventoryItem[];
  metadata: {store: string; purchaseDate: string; total: number};
}> => {
  try {
    console.log('[Textract] Starting analysis for image:', imageUri);

    // Convert image to Uint8Array
    const imageBytes = await convertImageToUint8Array(imageUri);

    // Validate image size
    if (imageBytes.length > MAX_IMAGE_SIZE_BYTES) {
      const sizeMB = (imageBytes.length / (1024 * 1024)).toFixed(1);
      throw new Error(
        `Image too large (${sizeMB}MB). Maximum allowed is ${MAX_IMAGE_SIZE_MB}MB. ` +
          `Please use a smaller image or take a photo from further away.`,
      );
    }

    console.log(
      '[Textract] Image size:',
      (imageBytes.length / (1024 * 1024)).toFixed(2),
      'MB',
    );

    // Call AWS Textract directly
    const analysisResult = await analyzeReceiptAsync(imageBytes);

    if (!analysisResult.success) {
      throw new Error(
        analysisResult.errorMessage || 'Textract analysis failed',
      );
    }

    console.log(
      '[Textract] Analysis successful. Found',
      analysisResult.items.length,
      'items from',
      analysisResult.store,
    );

    // Convert Textract items to InventoryItem format
    const inventoryItems: InventoryItem[] = analysisResult.items.map(item => ({
      id: generateUniqueId(),
      name: item.name,
      description: item.description || item.name,
      quantity: item.quantity,
      price: item.price,
      purchaseDate: analysisResult.purchaseDate,
      store: analysisResult.store,
    }));

    return {
      items: inventoryItems,
      metadata: {
        store: analysisResult.store,
        purchaseDate: analysisResult.purchaseDate,
        total: analysisResult.total,
      },
    };
  } catch (error: any) {
    console.error('[Textract] Error:', error);

    // Provide user-friendly error messages
    if (error.message?.includes('credentials')) {
      throw new Error(
        'AWS credentials not configured. Please contact support.',
      );
    }

    if (error.message?.includes('too large')) {
      throw error; // Re-throw size errors as-is
    }

    if (error.message?.includes('AccessDenied')) {
      throw new Error(
        'AWS access denied. Please check your permissions or contact support.',
      );
    }

    if (error.message?.includes('ThrottlingException')) {
      throw new Error(
        'Too many requests. Please wait a moment and try again.',
      );
    }

    // Generic error
    throw new Error(
      error.message || 'Failed to analyze receipt. Please try again.',
    );
  }
};

/**
 * Convert image URI to Uint8Array for AWS SDK
 * Reads the image file and converts it to a byte array
 */
const convertImageToUint8Array = async (uri: string): Promise<Uint8Array> => {
  try {
    // Read file as base64
    const base64 = await RNFS.readFile(uri, 'base64');

    // Convert base64 to Uint8Array using atob (available in React Native)
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error('[Textract] Error converting image:', error);
    throw new Error('Failed to process image file');
  }
};

/**
 * Generate unique ID for inventory items
 */
const generateUniqueId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
