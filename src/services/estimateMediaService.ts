/**
 * Estimate Media Service
 * Simplified version - uses only react-native-image-picker
 * No file system operations to avoid NativeEventEmitter issues
 */
import {
  launchCamera,
  launchImageLibrary,
  CameraOptions,
  ImageLibraryOptions,
  Asset,
} from 'react-native-image-picker';
import type {
  EstimateMedia,
  EstimateMediaType,
  EstimateMediaSource,
} from '../types/estimate';

// ===== Constants =====
const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024; // 200MB warning threshold

// ===== Helper Functions =====
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const getFileExtension = (uri: string, mimeType?: string): string => {
  if (mimeType) {
    const mimeExtMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/heic': 'heic',
      'image/heif': 'heif',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/mov': 'mov',
    };
    if (mimeExtMap[mimeType]) {
      return mimeExtMap[mimeType];
    }
  }
  const match = uri.match(/\.([a-zA-Z0-9]+)(\?|$)/);
  return match ? match[1].toLowerCase() : 'jpg';
};

// ===== Stub functions (no-op for now, will implement with proper native setup) =====

export const deleteLocalFile = async (_uri: string): Promise<void> => {
  // No-op for now - files managed by system
  console.log('[MediaService] deleteLocalFile called (no-op)');
};

export const deleteEstimateMediaFolder = async (_estimateId: string): Promise<void> => {
  // No-op for now
  console.log('[MediaService] deleteEstimateMediaFolder called (no-op)');
};

// ===== Picker Functions =====

interface PickerResult {
  media: EstimateMedia | null;
  mediaList?: EstimateMedia[]; // For multiple selection
  error?: string;
  cancelled?: boolean;
}

const processAsset = (
  asset: Asset,
  albumId: string,
  source: EstimateMediaSource,
  mediaType: EstimateMediaType
): EstimateMedia => {
  const mediaId = generateId();
  const ext = getFileExtension(asset.uri || '', asset.type);

  return {
    id: mediaId,
    type: mediaType,
    source,
    uri: asset.uri || '',
    thumbnailUri: mediaType === 'video' ? asset.uri : undefined, // Use same URI as thumbnail for now
    fileName: asset.fileName || `${mediaId}.${ext}`,
    mimeType: asset.type,
    sizeBytes: asset.fileSize,
    createdAt: new Date().toISOString(),
    albumId,
  };
};

/**
 * Pick images from the library (supports multiple selection)
 */
export const pickImageFromLibrary = async (
  _estimateId: string,
  albumId: string
): Promise<PickerResult> => {
  const options: ImageLibraryOptions = {
    mediaType: 'photo',
    quality: 0.8,
    selectionLimit: 0, // 0 = unlimited selection
  };

  try {
    const result = await launchImageLibrary(options);
    
    if (result.didCancel) {
      return {media: null, cancelled: true};
    }
    
    if (result.errorCode) {
      return {media: null, error: result.errorMessage || 'Failed to pick images'};
    }

    const assets = result.assets;
    if (!assets || assets.length === 0) {
      return {media: null, error: 'No images selected'};
    }

    // Process all selected images
    const mediaList = assets
      .filter(asset => asset.uri)
      .map(asset => processAsset(asset, albumId, 'library', 'image'));

    if (mediaList.length === 0) {
      return {media: null, error: 'No valid images selected'};
    }

    // Return first as media and all as mediaList
    return {
      media: mediaList[0],
      mediaList: mediaList.length > 1 ? mediaList : undefined,
    };
  } catch (error) {
    console.error('[MediaService] pickImageFromLibrary error:', error);
    return {media: null, error: 'Failed to pick images'};
  }
};

/**
 * Capture a photo with the camera
 */
export const capturePhoto = async (
  _estimateId: string,
  albumId: string
): Promise<PickerResult> => {
  const options: CameraOptions = {
    mediaType: 'photo',
    quality: 0.8,
    saveToPhotos: false,
  };

  try {
    const result = await launchCamera(options);
    
    if (result.didCancel) {
      return {media: null, cancelled: true};
    }
    
    if (result.errorCode) {
      return {media: null, error: result.errorMessage || 'Failed to capture photo'};
    }

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      return {media: null, error: 'No photo captured'};
    }

    const media = processAsset(asset, albumId, 'camera', 'image');
    return {media};
  } catch (error) {
    console.error('[MediaService] capturePhoto error:', error);
    return {media: null, error: 'Failed to capture photo'};
  }
};

/**
 * Pick a video from the library
 */
export const pickVideoFromLibrary = async (
  _estimateId: string,
  albumId: string
): Promise<PickerResult> => {
  const options: ImageLibraryOptions = {
    mediaType: 'video',
    selectionLimit: 1,
  };

  try {
    const result = await launchImageLibrary(options);
    
    if (result.didCancel) {
      return {media: null, cancelled: true};
    }
    
    if (result.errorCode) {
      return {media: null, error: result.errorMessage || 'Failed to pick video'};
    }

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      return {media: null, error: 'No video selected'};
    }

    if (asset.fileSize && asset.fileSize > MAX_VIDEO_SIZE_BYTES) {
      console.warn('[MediaService] Video is large:', Math.round(asset.fileSize / 1024 / 1024), 'MB');
    }

    const media = processAsset(asset, albumId, 'library', 'video');
    return {media};
  } catch (error) {
    console.error('[MediaService] pickVideoFromLibrary error:', error);
    return {media: null, error: 'Failed to pick video'};
  }
};

/**
 * Record a video with the camera
 */
export const recordVideo = async (
  _estimateId: string,
  albumId: string
): Promise<PickerResult> => {
  const options: CameraOptions = {
    mediaType: 'video',
    videoQuality: 'high',
    durationLimit: 60,
    saveToPhotos: false,
  };

  try {
    const result = await launchCamera(options);
    
    if (result.didCancel) {
      return {media: null, cancelled: true};
    }
    
    if (result.errorCode) {
      return {media: null, error: result.errorMessage || 'Failed to record video'};
    }

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      return {media: null, error: 'No video recorded'};
    }

    const media = processAsset(asset, albumId, 'camera', 'video');
    return {media};
  } catch (error) {
    console.error('[MediaService] recordVideo error:', error);
    return {media: null, error: 'Failed to record video'};
  }
};

export default {
  deleteLocalFile,
  deleteEstimateMediaFolder,
  pickImageFromLibrary,
  capturePhoto,
  pickVideoFromLibrary,
  recordVideo,
};
