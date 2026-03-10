import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import type { EstimateMedia } from '../../types/estimate';

const GRID_THUMB_SIZE = 56;
const MAX_VISIBLE_THUMBS = 4;

export interface LineItemGalleryPickerProps {
    /** All media in the estimate gallery */
    galleryMedia: EstimateMedia[];
    /** Media IDs currently selected for this line item */
    selectedMediaIds: string[];
    /** Callback when selection changes */
    onSelectionChange: (mediaIds: string[]) => void;
    /** Whether in read-only mode */
    readOnly?: boolean;
}

/**
 * LineItemGalleryPicker - Compact inline selector for gallery images
 * 
 * Shows selected count with mini thumbnails. Expands to grid for selection.
 */
export const LineItemGalleryPicker: React.FC<LineItemGalleryPickerProps> = ({
    galleryMedia,
    selectedMediaIds,
    onSelectionChange,
    readOnly = false,
}) => {
    const {colors} = useTheme();
    const [expanded, setExpanded] = useState(false);

    // Get selected media objects
    const selectedMedia = useMemo(() => {
        return galleryMedia.filter(m => selectedMediaIds.includes(m.id));
    }, [galleryMedia, selectedMediaIds]);

    // Toggle selection
    const toggleSelection = useCallback((mediaId: string) => {
        const newSelection = selectedMediaIds.includes(mediaId)
            ? selectedMediaIds.filter(id => id !== mediaId)
            : [...selectedMediaIds, mediaId];
        onSelectionChange(newSelection);
    }, [selectedMediaIds, onSelectionChange]);

    // Select all / deselect all
    const toggleAll = useCallback(() => {
        if (selectedMediaIds.length === galleryMedia.length) {
            onSelectionChange([]);
        } else {
            onSelectionChange(galleryMedia.map(m => m.id));
        }
    }, [selectedMediaIds, galleryMedia, onSelectionChange]);

    // No gallery media available
    if (galleryMedia.length === 0) {
        return null;
    }

    const hasSelection = selectedMedia.length > 0;
    const visibleThumbs = selectedMedia.slice(0, MAX_VISIBLE_THUMBS);
    const extraCount = Math.max(0, selectedMedia.length - MAX_VISIBLE_THUMBS);

    return (
        <View style={styles.container}>
            {/* Compact header - always visible */}
            <TouchableOpacity 
                style={[styles.header, {backgroundColor: colors.surface}]}
                onPress={() => !readOnly && setExpanded(!expanded)}
                activeOpacity={readOnly ? 1 : 0.7}
                disabled={readOnly}
            >
                {/* Left: thumbnails or icon */}
                <View style={styles.leftSection}>
                    {hasSelection ? (
                        <View style={styles.thumbStack}>
                            {visibleThumbs.map((media, index) => (
                                <Image
                                    key={media.id}
                                    source={{ uri: media.thumbnailUri || media.uri }}
                                    style={[
                                        styles.stackThumb,
                                        { marginLeft: index > 0 ? -8 : 0, zIndex: MAX_VISIBLE_THUMBS - index },
                                    ]}
                                />
                            ))}
                            {extraCount > 0 && (
                                <View style={[styles.extraBadge, {backgroundColor: colors.accent}, { marginLeft: -8 }]}>
                                    <Text style={[styles.extraText, {color: colors.textLight}]}>+{extraCount}</Text>
                                </View>
                            )}
                        </View>
                    ) : (
                        <Icon name="image" size={16} color={colors.textSecondary} />
                    )}
                </View>

                {/* Center: count text */}
                <Text style={[styles.countText, {color: colors.textSecondary}, hasSelection && {color: colors.text, fontWeight: '500'}]}>
                    {hasSelection ? `${selectedMedia.length} photo${selectedMedia.length !== 1 ? 's' : ''}` : 'Add photos'}
                </Text>

                {/* Right: expand/collapse icon */}
                {!readOnly && (
                    <Icon 
                        name={expanded ? "chevron-up" : "chevron-down"} 
                        size={14} 
                        color={colors.textSecondary} 
                    />
                )}
            </TouchableOpacity>

            {/* Expanded grid picker */}
            {expanded && (
                <View style={[styles.gridContainer, {backgroundColor: colors.surface}]}>
                    {/* Quick actions */}
                    <View style={styles.quickActions}>
                        <TouchableOpacity style={styles.quickBtn} onPress={toggleAll}>
                            <Icon 
                                name={selectedMediaIds.length === galleryMedia.length ? "x-square" : "check-square"} 
                                size={14} 
                                color={colors.accent} 
                            />
                            <Text style={[styles.quickBtnText, {color: colors.accent}]}>
                                {selectedMediaIds.length === galleryMedia.length ? 'Deselect all' : 'Select all'}
                            </Text>
                        </TouchableOpacity>
                        <Text style={[styles.galleryCount, {color: colors.textSecondary}]}>
                            {galleryMedia.length} in gallery
                        </Text>
                    </View>

                    {/* Grid */}
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.gridScroll}
                    >
                        {galleryMedia.map(media => {
                            const isSelected = selectedMediaIds.includes(media.id);
                            return (
                                <TouchableOpacity
                                    key={media.id}
                                    style={[styles.gridThumb, {borderColor: colors.border}, isSelected && {borderColor: colors.accent}]}
                                    onPress={() => toggleSelection(media.id)}
                                    activeOpacity={0.7}
                                >
                                    <Image
                                        source={{ uri: media.thumbnailUri || media.uri }}
                                        style={styles.gridImage}
                                    />
                                    <View style={[
                                        styles.selectIndicator,
                                        {borderColor: colors.border, backgroundColor: colors.surface},
                                        isSelected && {backgroundColor: colors.accent, borderColor: colors.accent}
                                    ]}>
                                        {isSelected && <Icon name="check" size={10} color="#FFF" />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 4,
        position: 'relative',
        zIndex: 100,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8,

        borderRadius: 6,
        gap: 8,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    thumbStack: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stackThumb: {
        width: 24,
        height: 24,
        borderRadius: 4,
        borderWidth: 1.5,

    },
    extraBadge: {
        width: 24,
        height: 24,
        borderRadius: 4,

        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,

    },
    extraText: {
        fontSize: 9,
        fontWeight: '600',

    },
    countText: {
        flex: 1,
        fontSize: 12,

    },
    countTextActive: {

        fontWeight: '500',
    },
    gridContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 4,

        borderRadius: 12,
        padding: 12,
        zIndex: 1000,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    quickActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    quickBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    quickBtnText: {
        fontSize: 11,

        fontWeight: '500',
    },
    galleryCount: {
        fontSize: 10,

    },
    gridScroll: {
        gap: 6,
    },
    gridThumb: {
        width: GRID_THUMB_SIZE,
        height: GRID_THUMB_SIZE,
        borderRadius: 6,
        overflow: 'hidden',

    },
    gridThumbSelected: {
        borderWidth: 2,

    },
    gridImage: {
        width: '100%',
        height: '100%',
    },
    selectIndicator: {
        position: 'absolute',
        top: 3,
        right: 3,
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#FFF',
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectIndicatorActive: {
  },
});

export default LineItemGalleryPicker;
