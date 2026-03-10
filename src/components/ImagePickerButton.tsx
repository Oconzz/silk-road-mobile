/**
 * ImagePickerButton Component
 * A reusable component for picking/capturing images
 */

import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    StyleSheet,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { launchImageLibrary, launchCamera, Asset } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';

interface ImagePickerButtonProps {
    /** Current image URI (local or remote) */
    imageUri?: string;
    /** Callback when image is selected */
    onImageSelected: (uri: string, mimeType?: string) => void;
    /** Callback when image is removed */
    onImageRemoved?: () => void;
    /** Whether an upload is in progress */
    isUploading?: boolean;
    /** Label to display */
    label?: string;
    /** Placeholder text when no image */
    placeholder?: string;
    /** Size of the preview (width = height) */
    size?: number;
}

export const ImagePickerButton: React.FC<ImagePickerButtonProps> = ({
    imageUri,
    onImageSelected,
    onImageRemoved,
    isUploading = false,
    label = 'Product Image',
    placeholder = 'Add Photo',
    size = 100,
}) => {
    const {colors} = useTheme();
    const [localUri, setLocalUri] = useState<string | undefined>(imageUri);

    const handleSelectImage = useCallback(() => {
        Alert.alert(
            'Add Photo',
            'Choose an option',
            [
                {
                    text: 'Camera',
                    onPress: () => {
                        launchCamera(
                            {
                                mediaType: 'photo',
                                quality: 0.8,
                                maxWidth: 1280,
                                maxHeight: 1280,
                            },
                            (response) => {
                                if (response.didCancel) return;
                                if (response.errorCode) {
                                    console.error('Camera error:', response.errorMessage);
                                    return;
                                }
                                const asset = response.assets?.[0];
                                if (asset?.uri) {
                                    setLocalUri(asset.uri);
                                    onImageSelected(asset.uri, asset.type || 'image/jpeg');
                                }
                            }
                        );
                    },
                },
                {
                    text: 'Photo Library',
                    onPress: () => {
                        launchImageLibrary(
                            {
                                mediaType: 'photo',
                                quality: 0.8,
                                maxWidth: 1280,
                                maxHeight: 1280,
                            },
                            (response) => {
                                if (response.didCancel) return;
                                if (response.errorCode) {
                                    console.error('Image picker error:', response.errorMessage);
                                    return;
                                }
                                const asset = response.assets?.[0];
                                if (asset?.uri) {
                                    setLocalUri(asset.uri);
                                    onImageSelected(asset.uri, asset.type || 'image/jpeg');
                                }
                            }
                        );
                    },
                },
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
            ]
        );
    }, [onImageSelected]);

    const handleRemoveImage = useCallback(() => {
        setLocalUri(undefined);
        onImageRemoved?.();
    }, [onImageRemoved]);

    const displayUri = localUri || imageUri;

    return (
        <View style={styles.container}>
            {label && <Text style={[styles.label, {color: colors.textSecondary}]}>{label}</Text>}

            <TouchableOpacity                 style={[styles.imageButton, {backgroundColor: colors.surface}, { width: size, height: size }]}
                onPress={handleSelectImage}
                disabled={isUploading}
                activeOpacity={0.7}
            >
                {isUploading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color={colors.accent} />
                        <Text style={[styles.loadingText, {color: colors.text}]}>Uploading...</Text>
                    </View>
                ) : displayUri ? (
                    <Image
                        source={{ uri: displayUri }}
                        style={[styles.imagePreview, { width: size, height: size }]}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={styles.placeholderContainer}>
                        <Icon name="camera" size={24} color={colors.textSecondary} />
                        <Text style={[styles.placeholderText, {color: colors.textSecondary}]}>{placeholder}</Text>
                    </View>
                )}
            </TouchableOpacity>

            {displayUri && !isUploading && (
                <TouchableOpacity
                    style={[styles.removeButton, {backgroundColor: colors.error}]}
                    onPress={handleRemoveImage}
                    activeOpacity={0.7}
                >
                    <Icon name="x" size={14} color={colors.textLight} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing.md,
        position: 'relative',
    },
    label: {
        fontSize: theme.fontSize.sm,
        fontWeight: '600',

        marginBottom: theme.spacing.xs,
    },
    imageButton: {
        borderRadius: theme.borderRadius.md,
        borderWidth: 2,

        borderStyle: 'dashed',

        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    placeholderContainer: {
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    placeholderText: {
        fontSize: theme.fontSize.xs,

        fontWeight: '500',
    },
    imagePreview: {
        borderRadius: theme.borderRadius.md - 2,
    },
    loadingContainer: {
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    loadingText: {
        fontSize: theme.fontSize.xs,

    },
    removeButton: {
        position: 'absolute',
        top: 20,
        right: -10,
        width: 24,
        height: 24,
        borderRadius: 12,

        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,

    },
});

export default ImagePickerButton;
