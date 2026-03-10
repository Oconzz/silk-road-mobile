/**
 * Media Upload Service
 * Handles 2-step uploads to S3 via presigned URLs
 * 
 * Flow:
 * 1. Check network connectivity
 * 2. Request presigned upload URL from backend
 * 3. Upload file directly to S3 using the presigned URL
 * 4. Return the S3 key for storage in the entity
 */

import { apiClient } from './api/core/httpClient';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// ===== Types =====

export type EntityType = 'estimate' | 'job' | 'inventory';

export interface SignUploadRequest {
    fileName: string;
    entityType: EntityType;
    entityId: string;
    mimeType?: string;
}

export interface SignUploadResponse {
    uploadUrl: string;
    fileKey: string;
    contentType: string;
}

export interface UploadResult {
    success: boolean;
    s3Key?: string;
    error?: string;
    errorType?: 'network' | 'offline' | 'server' | 'unknown';
}

export interface MediaUploadProgress {
    loaded: number;
    total: number;
    percentage: number;
}

// ===== Helper Functions =====

/**
 * Check if device is connected to the network
 */
export const isOnline = async (): Promise<boolean> => {
    try {
        const state = await NetInfo.fetch();
        return state.isConnected === true && state.isInternetReachable !== false;
    } catch (error) {
        console.warn('[MediaUpload] NetInfo check failed:', error);
        return true; // Assume online if check fails
    }
};

/**
 * Show offline alert to user
 */
export const showOfflineAlert = () => {
    Alert.alert(
        'No Connection',
        'You are currently offline. Please check your internet connection and try again.',
        [{ text: 'OK' }]
    );
};

/**
 * Classify error type for better UX
 */
const classifyError = (error: any): 'network' | 'offline' | 'server' | 'unknown' => {
    const message = error?.message?.toLowerCase() || '';
    if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
        return 'network';
    }
    if (message.includes('offline') || message.includes('no connection')) {
        return 'offline';
    }
    if (error?.response?.status >= 500) {
        return 'server';
    }
    return 'unknown';
};

/**
 * Extract MIME type from file URI or provide default
 */
const getMimeType = (uri: string, providedMimeType?: string): string => {
    if (providedMimeType) return providedMimeType;

    const extension = uri.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        heic: 'image/heic',
        heif: 'image/heif',
        webp: 'image/webp',
        mp4: 'video/mp4',
        mov: 'video/quicktime',
    };

    return mimeTypes[extension] || 'image/jpeg';
};

/**
 * Extract filename from URI
 */
const getFileName = (uri: string): string => {
    const parts = uri.split('/');
    return parts[parts.length - 1] || `file-${Date.now()}.jpg`;
};

// ===== Main Service =====

/**
 * Request a presigned upload URL from the backend
 */
export const requestUploadUrl = async (
    request: SignUploadRequest
): Promise<SignUploadResponse> => {
    console.log('[MediaUpload] Requesting presigned URL for:', request);

    const response = await apiClient.post<SignUploadResponse>('/MediaUpload/sign', {
        fileName: request.fileName,
        entityType: request.entityType,
        entityId: request.entityId,
        mimeType: request.mimeType || 'image/jpeg',
    });

    console.log('[MediaUpload] Got presigned URL, key:', response.data.fileKey);
    return response.data;
};

/**
 * Upload a file directly to S3 using a presigned URL
 * Uses XMLHttpRequest for better reliability in release builds (TestFlight)
 * 
 * @param presignedUrl - The S3 presigned URL for PUT
 * @param fileUri - Local file URI (e.g., file:///path/to/image.jpg)
 * @param contentType - MIME type for the file
 * @param onProgress - Optional progress callback
 */
export const uploadToS3 = async (
    presignedUrl: string,
    fileUri: string,
    contentType: string,
    onProgress?: (progress: MediaUploadProgress) => void
): Promise<boolean> => {
    console.log('[MediaUpload] Starting S3 upload to:', presignedUrl.substring(0, 80) + '...');
    console.log('[MediaUpload] File URI:', fileUri);
    console.log('[MediaUpload] Content-Type:', contentType);

    try {
        // Read file as blob - this works for both iOS and Android
        console.log('[MediaUpload] Fetching file to create blob...');
        const fileResponse = await fetch(fileUri);
        
        if (!fileResponse.ok) {
            console.error('[MediaUpload] Failed to read local file:', fileResponse.status);
            return false;
        }
        
        const blob = await fileResponse.blob();
        console.log('[MediaUpload] Blob created - size:', blob.size, 'bytes, type:', blob.type || contentType);

        if (blob.size === 0) {
            console.error('[MediaUpload] Blob is empty, cannot upload');
            return false;
        }

        // Use XMLHttpRequest for upload - more reliable in release builds
        return new Promise<boolean>((resolve) => {
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && onProgress) {
                    const progress: MediaUploadProgress = {
                        loaded: event.loaded,
                        total: event.total,
                        percentage: Math.round((event.loaded / event.total) * 100),
                    };
                    console.log('[MediaUpload] Progress:', progress.percentage + '%');
                    onProgress(progress);
                }
            };

            xhr.onload = () => {
                console.log('[MediaUpload] XHR completed with status:', xhr.status);
                if (xhr.status >= 200 && xhr.status < 300) {
                    console.log('[MediaUpload] S3 upload successful!');
                    resolve(true);
                } else {
                    console.error('[MediaUpload] S3 upload failed:', xhr.status, xhr.responseText);
                    resolve(false);
                }
            };

            xhr.onerror = (error) => {
                console.error('[MediaUpload] XHR error during S3 upload:', error);
                resolve(false);
            };

            xhr.ontimeout = () => {
                console.error('[MediaUpload] XHR timeout during S3 upload');
                resolve(false);
            };

            // Set timeout to 2 minutes for large files
            xhr.timeout = 120000;

            xhr.open('PUT', presignedUrl, true);
            xhr.setRequestHeader('Content-Type', contentType);
            
            console.log('[MediaUpload] Sending blob to S3...');
            xhr.send(blob);
        });
    } catch (error: any) {
        console.error('[MediaUpload] S3 upload error:', error?.message || error);
        return false;
    }
};

/**
 * Upload a file with the complete 2-step flow
 * 
 * @param fileUri - Local file URI
 * @param entityType - Type of entity (estimate, job, inventory)
 * @param entityId - ID of the entity
 * @param mimeType - Optional MIME type (auto-detected if not provided)
 * @param onProgress - Optional progress callback
 */
export const uploadFile = async (
    fileUri: string,
    entityType: EntityType,
    entityId: string,
    mimeType?: string,
    onProgress?: (progress: MediaUploadProgress) => void
): Promise<UploadResult> => {
    try {
        console.log(`[MediaUpload] uploadFile called for ${entityType}/${entityId}`);

        // Step 0: Check connectivity
        const online = await isOnline();
        if (!online) {
            console.warn('[MediaUpload] Device is offline, cancelling upload');
            showOfflineAlert();
            return {
                success: false,
                error: 'Device is offline',
                errorType: 'offline',
            };
        }

        // Step 1: Prepare
        const fileName = getFileName(fileUri);
        const detectedMimeType = getMimeType(fileUri, mimeType);

        console.log(`[MediaUpload] File: ${fileName}, MIME: ${detectedMimeType}`);

        // Step 2: Get presigned URL
        const signResponse = await requestUploadUrl({
            fileName,
            entityType,
            entityId,
            mimeType: detectedMimeType,
        });

        // Step 3: Upload to S3
        const uploadSuccess = await uploadToS3(
            signResponse.uploadUrl,
            fileUri,
            signResponse.contentType,
            onProgress
        );

        if (!uploadSuccess) {
            return {
                success: false,
                error: 'Failed to upload file to S3',
                errorType: 'network',
            };
        }

        // Step 4: Return the S3 key for persistence
        return {
            success: true,
            s3Key: signResponse.fileKey,
        };
    } catch (error: any) {
        console.error('[MediaUpload] uploadFile error:', error);
        return {
            success: false,
            error: error.message || 'Unknown error during upload',
            errorType: classifyError(error),
        };
    }
};

/**
 * Upload multiple files
 */
export const uploadFiles = async (
    files: Array<{ uri: string; mimeType?: string }>,
    entityType: EntityType,
    entityId: string,
    onProgress?: (index: number, progress: MediaUploadProgress) => void
): Promise<UploadResult[]> => {
    console.log(`[MediaUpload] Uploading ${files.length} files for ${entityType}/${entityId}`);

    const results: UploadResult[] = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const result = await uploadFile(
            file.uri,
            entityType,
            entityId,
            file.mimeType,
            onProgress ? (progress) => onProgress(i, progress) : undefined
        );
        results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[MediaUpload] Completed: ${successCount}/${files.length} successful`);

    return results;
};

/**
 * Get a presigned download URL for viewing an image
 */
export const getDownloadUrl = async (s3Key: string): Promise<string | null> => {
    if (!s3Key) return null;

    try {
        const response = await apiClient.get<{ downloadUrl: string }>('/MediaUpload/download-url', {
            params: { s3Key },
        });
        return response.data.downloadUrl;
    } catch (error) {
        console.error('[MediaUpload] Error getting download URL:', error);
        return null;
    }
};

export default {
    uploadFile,
    uploadFiles,
    requestUploadUrl,
    uploadToS3,
    getDownloadUrl,
};
