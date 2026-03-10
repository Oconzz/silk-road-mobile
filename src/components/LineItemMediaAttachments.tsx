import React, { useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Alert,
    ActionSheetIOS,
    Platform,
    ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import {
    pickImageFromLibrary,
    capturePhoto,
} from '../services/estimateMediaService';
import type { EstimateMedia } from '../types/estimate';

// Compact thumbnail size for inline display
const THUMB_SIZE = 56;
const MAX_VISIBLE_THUMBS = 4;

export interface LineItemMediaAttachmentsProps {
    /** Unique ID of the line item */
    lineItemId: string;
    /** Estimate/Job ID for storage path */
    parentId: string;
    /** Current media items for this line item */
    media: EstimateMedia[];
    /** Callback when media is added */
    onAddMedia: (media: EstimateMedia) => void;
    /** Callback when media is removed */
    onRemoveMedia: (mediaId: string) => void;
    /** Callback when thumbnail is tapped (for full preview) */
    onPreview?: (media: EstimateMedia, index: number) => void;
    /** Whether the component is in read-only mode */
    readOnly?: boolean;
    /** Album ID to assign new media to */
    albumId?: string;
}

/**
 * LineItemMediaAttachments - Compact inline media attachment component for line items
 * 
 * Used in:
 * - CreateEstimateScreen (line item rows)
 * - CreateJobScreen (line item rows)
 * - JobDetailScreen (read-only view)
 */
export const LineItemMediaAttachments: React.FC<LineItemMediaAttachmentsProps> = ({
    lineItemId,
    parentId,
    media,
    onAddMedia,
    onRemoveMedia,
    onPreview,
    readOnly = false,
    albumId = 'default-overview',
}) => {
    const { colors } = useTheme();
    // Filter media for this specific line item
    const lineItemMedia = useMemo(() => {
        return media.filter(m => m.lineItemId === lineItemId);
    }, [media, lineItemId]);

    // Show action sheet for adding media
    const showAddMediaSheet = useCallback(() => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Cancel', 'Take Photo', 'Choose from Library'],
                    cancelButtonIndex: 0,
                },
                async (buttonIndex) => {
                    if (buttonIndex === 0) return;

                    try {
                        let result;
                        if (buttonIndex === 1) {
                            // Take Photo
                            result = await capturePhoto(parentId, albumId);
                        } else {
                            // Choose from Library
                            result = await pickImageFromLibrary(parentId, albumId);
                        }

                        if (result?.media) {
                            // Tag media with lineItemId
                            const taggedMedia: EstimateMedia = {
                                ...result.media,
                                lineItemId,
                            };
                            onAddMedia(taggedMedia);
                        }

                        if (result?.error) {
                            Alert.alert('Error', result.error);
                        }
                    } catch (error) {
                        console.error('[LineItemMedia] Add error:', error);
                        Alert.alert('Error', 'Failed to add photo');
                    }
                }
            );
        } else {
            // Android fallback
            Alert.alert(
                'Add Photo',
                'Choose an option',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Take Photo',
                        onPress: async () => {
                            try {
                                const result = await capturePhoto(parentId, albumId);
                                if (result?.media) {
                                    const taggedMedia: EstimateMedia = {
                                        ...result.media,
                                        lineItemId,
                                    };
                                    onAddMedia(taggedMedia);
                                }
                            } catch (error) {
                                console.error('[LineItemMedia] Camera error:', error);
                            }
                        },
                    },
                    {
                        text: 'Choose from Library',
                        onPress: async () => {
                            try {
                                const result = await pickImageFromLibrary(parentId, albumId);
                                if (result?.media) {
                                    const taggedMedia: EstimateMedia = {
                                        ...result.media,
                                        lineItemId,
                                    };
                                    onAddMedia(taggedMedia);
                                }
                            } catch (error) {
                                console.error('[LineItemMedia] Library error:', error);
                            }
                        },
                    },
                ]
            );
        }
    }, [parentId, albumId, lineItemId, onAddMedia]);

    // Handle remove with confirmation
    const handleRemove = useCallback((mediaId: string) => {
        Alert.alert(
            'Remove Photo',
            'Remove this photo from this item?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => onRemoveMedia(mediaId),
                },
            ]
        );
    }, [onRemoveMedia]);

    // Handle thumbnail tap
    const handleThumbnailTap = useCallback((item: EstimateMedia, index: number) => {
        if (onPreview) {
            onPreview(item, index);
        }
    }, [onPreview]);

    // Calculate how many are hidden
    const hiddenCount = lineItemMedia.length > MAX_VISIBLE_THUMBS
        ? lineItemMedia.length - MAX_VISIBLE_THUMBS + 1
        : 0;

    const visibleMedia = hiddenCount > 0
        ? lineItemMedia.slice(0, MAX_VISIBLE_THUMBS - 1)
        : lineItemMedia;

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* Thumbnails */}
                {visibleMedia.map((item, index) => (
                    <View key={item.id} style={styles.thumbContainer}>
                        <TouchableOpacity
                            style={styles.thumb}
                            onPress={() => handleThumbnailTap(item, index)}
                            activeOpacity={0.8}
                        >
                            <Image
                                source={{ uri: item.thumbnailUri || item.uri }}
                                style={styles.thumbImage}
                                resizeMode="cover"
                            />
                            {item.type === 'video' && (
                                <View style={styles.videoOverlay}>
                                    <Icon name="play" size={16} color="white" />
                                </View>
                            )}
                        </TouchableOpacity>
                        {!readOnly && (
                            <TouchableOpacity
                                style={[styles.removeBtn, {backgroundColor: colors.error}]}
                                onPress={() => handleRemove(item.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Icon name="x" size={10} color="white" />
                            </TouchableOpacity>
                        )}
                    </View>
                ))}

                {/* Hidden count indicator */}
                {hiddenCount > 0 && (
                    <TouchableOpacity
                        style={[styles.moreIndicator, {backgroundColor: colors.background}]}
                        onPress={() => lineItemMedia[0] && handleThumbnailTap(lineItemMedia[0], 0)}
                    >
                        <Text style={[styles.moreText, {color: colors.textLight}]}>+{hiddenCount}</Text>
                    </TouchableOpacity>
                )}

                {/* Add button */}
                {!readOnly && (
                    <TouchableOpacity
                        style={[styles.addBtn, {backgroundColor: colors.accent}]}
                        onPress={showAddMediaSheet}
                        activeOpacity={0.7}
                    >
                        <Icon name="camera" size={18} color={colors.accent} />
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* Empty state hint (only when no media and not readOnly) */}
            {lineItemMedia.length === 0 && !readOnly && (
                <TouchableOpacity
                    style={styles.emptyHint}
                    onPress={showAddMediaSheet}
                >
                    <Icon name="image" size={14} color={colors.textSecondary} />
                    <Text style={[styles.emptyHintText, {color: colors.textSecondary}]}>Add photos</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: theme.spacing.xs,
    },
    scrollContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingVertical: theme.spacing.xs,
    },
    thumbContainer: {
        position: 'relative',
    },
    thumb: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: theme.borderRadius.sm,
        overflow: 'hidden',

    },
    thumbImage: {
        width: '100%',
        height: '100%',
    },
    videoOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeBtn: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 18,
        height: 18,
        borderRadius: 9,

        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,

        zIndex: 10,
    },
    moreIndicator: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: theme.borderRadius.sm,

        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,

    },
    moreText: {
        fontSize: theme.fontSize.md,
        fontWeight: theme.fontWeight.semibold,

    },
    addBtn: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: theme.borderRadius.sm,

        borderWidth: 1.5,

        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingVertical: theme.spacing.xs,
    },
    emptyHintText: {
        fontSize: theme.fontSize.xs,

    },
});

export default LineItemMediaAttachments;
