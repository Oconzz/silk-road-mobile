/**
 * SecureImage Component
 * Displays images from S3 by fetching presigned download URLs
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Image,
    ImageStyle,
    View,
    StyleSheet,
    ActivityIndicator,
    ImageProps,
    StyleProp,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { getDownloadUrl } from '../services/mediaUploadService';
import { getCachedUrl, setCachedUrl } from '../services/imageCacheService';

interface SecureImageProps extends Omit<ImageProps, 'source'> {
    /** S3 key for the image */
    s3Key?: string;
    /** Fallback local URI if S3 key is not available */
    fallbackUri?: string;
    /** Style for the image */
    style?: StyleProp<ImageStyle>;
    /** Size for the placeholder icon */
    placeholderIconSize?: number;
    /** Show loading indicator */
    showLoading?: boolean;
}

export const SecureImage: React.FC<SecureImageProps> = ({
    s3Key,
    fallbackUri,
    style,
    placeholderIconSize = 32,
    showLoading = true,
    ...imageProps
}) => {
    const {colors} = useTheme();
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    const loadImage = useCallback(async () => {
        // If we have a local fallback URI, use it first
        if (fallbackUri && !s3Key) {
            setImageUrl(fallbackUri);
            return;
        }

        // If no s3Key and no fallback, show placeholder
        if (!s3Key) {
            setError(true);
            return;
        }

        // Check cache first - avoids API call entirely
        const cached = getCachedUrl(s3Key);
        if (cached) {
            setImageUrl(cached);
            return;
        }

        setLoading(true);
        setError(false);

        try {
            const url = await getDownloadUrl(s3Key);
            if (url) {
                // Cache the presigned URL for future use
                setCachedUrl(s3Key, url);
                setImageUrl(url);
            } else {
                // Fall back to local URI if available
                if (fallbackUri) {
                    setImageUrl(fallbackUri);
                } else {
                    setError(true);
                    console.warn('[SecureImage] Could not get presigned URL for:', s3Key);
                }
            }
        } catch (err) {
            console.error('[SecureImage] Error loading image:', err);
            // Fall back to local URI if available
            if (fallbackUri) {
                setImageUrl(fallbackUri);
            } else {
                setError(true);
            }
        } finally {
            setLoading(false);
        }
    }, [s3Key, fallbackUri]);

    useEffect(() => {
        loadImage();
    }, [loadImage]);

    // Show loading state
    if (loading && showLoading) {
        return (
            <View style={[styles.placeholder, style]}>
                <ActivityIndicator size="small" color={colors.accent} />
            </View>
        );
    }

    // Show error/placeholder state
    if (error || !imageUrl) {
        return (
            <View style={[styles.placeholder, style]}>
                <Icon name="image" size={placeholderIconSize} color={colors.textSecondary} />
            </View>
        );
    }

    // Show the image
    return (
        <Image
            source={{ uri: imageUrl }}
            style={style}
            onError={() => {
                console.warn('[SecureImage] Image load error, falling back');
                if (fallbackUri && imageUrl !== fallbackUri) {
                    setImageUrl(fallbackUri);
                } else {
                    setError(true);
                }
            }}
            {...imageProps}
        />
    );
};

const styles = StyleSheet.create({
    placeholder: {

        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: theme.borderRadius.sm,
    },
});

export default SecureImage;
