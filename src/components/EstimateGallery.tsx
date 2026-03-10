import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  Modal,
  Dimensions,
  ActionSheetIOS,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import ImageViewing from 'react-native-image-viewing';
import Video from 'react-native-video';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useEstimate } from '../context/EstimateContext';
import {
  pickImageFromLibrary,
  capturePhoto,
  pickVideoFromLibrary,
  recordVideo,
} from '../services/estimateMediaService';
import { uploadFile, EntityType } from '../services/mediaUploadService';
import type { EstimateMedia, EstimateAlbum } from '../types/estimate';
import { DEFAULT_ALBUM_NAME } from '../types/estimate';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_COLUMNS = 5;
const GRID_SPACING = 4;
const GALLERY_PADDING = 16;
const THUMB_SIZE = (SCREEN_WIDTH - (GALLERY_PADDING * 2) - (GRID_COLUMNS - 1) * GRID_SPACING) / GRID_COLUMNS;

interface EstimateGalleryProps {
  estimateId: string;
  entityType?: EntityType;
  readOnly?: boolean;
  estimate?: {
    media: EstimateMedia[];
    albums: EstimateAlbum[];
    lineItems?: Array<{ id: string; description: string; mediaIds?: string[] }>;
  };
  onAddMedia?: (media: EstimateMedia) => void;
  onRemoveMedia?: (mediaId: string) => void;
  onDeleteAlbum?: (albumId: string) => void;
}

export const EstimateGallery: React.FC<EstimateGalleryProps> = ({
  estimateId,
  entityType = 'estimate',
  readOnly = false,
  estimate,
  onAddMedia,
  onRemoveMedia,
  onDeleteAlbum,
}) => {
  const {colors} = useTheme();
  const {
    draftEstimate,
    deleteAlbum: contextDeleteAlbum,
    addMedia: contextAddMedia,
    removeMedia: contextRemoveMedia,
  } = useEstimate();

  // Prefer props over context
  const activeEstimate = estimate || draftEstimate;
  const deleteAlbumRaw = onDeleteAlbum || contextDeleteAlbum;
  const addMediaRaw = onAddMedia || contextAddMedia;
  const removeMediaRaw = onRemoveMedia || contextRemoveMedia;

  // Wrap to match expectations if needed, but for now assuming compatible signatures
  const deleteAlbum = deleteAlbumRaw;
  const addMedia = addMediaRaw;
  const removeMedia = removeMediaRaw;

  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [videoPlayerVisible, setVideoPlayerVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<EstimateMedia | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [mediaToDelete, setMediaToDelete] = useState<EstimateMedia | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadPercentage, setUploadPercentage] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  // Helper to check if entityId is valid (not 'draft' or empty)
  const isValidEntityId = useCallback((id: string): boolean => {
    if (!id || id === 'draft' || id === 'new' || id.length < 10) {
      return false;
    }
    return true;
  }, []);

  // Resolve the entityId to use for S3 upload.
  // In draft/creation mode use a well-known placeholder UUID so the backend
  // can generate a presigned URL (it only uses this for the S3 folder path).
  const DRAFT_PLACEHOLDER_ID = '00000000-0000-0000-0000-000000000001';
  const uploadEntityId = useMemo(() => {
    if (isValidEntityId(estimateId)) return estimateId;
    return DRAFT_PLACEHOLDER_ID;
  }, [estimateId, isValidEntityId]);

  // Helper to upload media to S3 and add to estimate/draft
  const uploadAndAddMedia = useCallback(async (media: EstimateMedia) => {
    // Check video size (limit to 50MB)
    if (media.type === 'video' && media.sizeBytes && media.sizeBytes > 50 * 1024 * 1024) {
      Alert.alert(
        'File Too Large',
        'Video size exceeds 50MB limit. Please choose a smaller video.',
        [{ text: 'OK' }]
      );
      return;
    }

    const isDraft = !isValidEntityId(estimateId);

    try {
      setIsUploading(true);
      setUploadProgress('Uploading...');
      setUploadPercentage(0);
      const result = await uploadFile(
        media.uri,
        entityType,
        uploadEntityId,
        media.mimeType,
        (progress) => {
          setUploadPercentage(progress.percentage);
        }
      );

      if (result.success && result.s3Key) {
        const safeAlbumId = (!media.albumId || media.albumId === 'default-overview') ? null : media.albumId;

        // In draft mode: addMedia stores locally via EstimateContext (isLocal flag)
        // In saved mode: addMedia calls the backend API
        addMedia({
          ...media,
          s3Key: result.s3Key,
          albumId: safeAlbumId,
          isLocal: isDraft,
        } as any);

        console.log('[Gallery] Media uploaded to S3:', result.s3Key, isDraft ? '(local draft)' : '');
      } else {
        console.warn('[Gallery] S3 upload failed:', result.error);
        Alert.alert('Upload Failed', 'Failed to upload media. Please try again.');
      }
    } catch (error) {
      console.error('[Gallery] Upload error:', error);
      Alert.alert('Error', 'An error occurred while uploading media.');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      setUploadPercentage(0);
    }
  }, [estimateId, uploadEntityId, addMedia, isValidEntityId, entityType]);

  // Helper to upload multiple media items
  const uploadAndAddMediaList = useCallback(async (mediaList: EstimateMedia[]) => {
    for (let i = 0; i < mediaList.length; i++) {
      setUploadProgress(`Uploading ${i + 1} of ${mediaList.length}...`);
      await uploadAndAddMedia(mediaList[i]);
    }
    setUploadProgress(null);
    setUploadPercentage(0);
  }, [uploadAndAddMedia]);

  // Get albums with default album ensured
  const albums = useMemo(() => {
    if (!activeEstimate) return [];

    let albumList = [...(activeEstimate.albums || [])];
    const hasDefault = albumList.some(a => a.name === DEFAULT_ALBUM_NAME);

    if (!hasDefault) {
      albumList = [{
        id: 'default-overview',
        name: DEFAULT_ALBUM_NAME,
        createdAt: new Date().toISOString(),
        sortOrder: 0,
      }, ...albumList];
    }

    return albumList.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [activeEstimate]);

  // Filter media by selected album
  const filteredMedia = useMemo(() => {
    if (!activeEstimate) return [];

    if (!selectedAlbumId) {
      return activeEstimate.media || []; // Show all
    }

    return (activeEstimate.media || []).filter(m => m.albumId === selectedAlbumId);
  }, [activeEstimate, selectedAlbumId]);

  // Images for viewer
  const viewerImages = useMemo(() => {
    return filteredMedia
      .filter(m => m.type === 'image')
      .map(m => {
        // Resolve URI from multiple possible fields
        const resolvedUri = (m as any).webUrl || m.uri || (m as any).url;
        return { uri: resolvedUri };
      })
      .filter(img => !!img.uri); // Filter out items without valid URI
  }, [filteredMedia]);

  // Get default album ID
  const defaultAlbumId = useMemo(() => {
    const defaultAlbum = albums.find(a => a.name === DEFAULT_ALBUM_NAME);
    return defaultAlbum?.id || 'default-overview';
  }, [albums]);

  // Show action sheet for adding media (native iOS approach)
  const showAddMediaSheet = useCallback(() => {
    const albumId = selectedAlbumId || defaultAlbumId;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose Photos', 'Record Video', 'Choose Video'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) return;

          setIsLoading(true);
          try {
            let result;
            switch (buttonIndex) {
              case 1: // Take Photo
                result = await capturePhoto(estimateId, albumId);
                if (result?.media) await uploadAndAddMedia(result.media);
                break;
              case 2: // Choose Photos (multiple)
                result = await pickImageFromLibrary(estimateId, albumId);
                if (result && 'mediaList' in result && result.mediaList) {
                  await uploadAndAddMediaList(result.mediaList);
                } else if (result?.media) {
                  await uploadAndAddMedia(result.media);
                }
                break;
              case 3: // Record Video
                try {
                  result = await recordVideo(estimateId, albumId);
                  if (result?.media) await uploadAndAddMedia(result.media);
                } catch (recordError) {
                  console.error('[Gallery] recordVideo crashed:', recordError);
                  Alert.alert('Camera Error', 'Unable to record video. Please try again or use "Choose Video" instead.');
                }
                break;
              case 4: // Choose Video
                result = await pickVideoFromLibrary(estimateId, albumId);
                if (result?.media) await uploadAndAddMedia(result.media);
                break;
            }

            if (result?.error) {
              Alert.alert('Error', result.error);
            }
          } catch (error) {
            console.error('[Gallery] Add media error:', error);
            Alert.alert('Error', 'Failed to add media');
          } finally {
            setIsLoading(false);
          }
        }
      );
    } else {
      // Android fallback
      Alert.alert(
        'Add Media',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Take Photo',
            onPress: async () => {
              setIsLoading(true);
              const result = await capturePhoto(estimateId, albumId);
              if (result?.media) await uploadAndAddMedia(result.media);
              setIsLoading(false);
            },
          },
          {
            text: 'Choose Photos',
            onPress: async () => {
              setIsLoading(true);
              const result = await pickImageFromLibrary(estimateId, albumId);
              if (result && 'mediaList' in result && result.mediaList) {
                await uploadAndAddMediaList(result.mediaList);
              } else if (result?.media) {
                await uploadAndAddMedia(result.media);
              }
              setIsLoading(false);
            },
          },
        ]
      );
    }
  }, [estimateId, selectedAlbumId, defaultAlbumId, uploadAndAddMedia, uploadAndAddMediaList]);

  // Handle media tap
  const handleMediaTap = useCallback((media: EstimateMedia, _index: number) => {
    if (media.type === 'video') {
      setSelectedVideo(media);
      setVideoPlayerVisible(true);
    } else {
      // Find index in images only
      const imageIndex = filteredMedia
        .filter(m => m.type === 'image')
        .findIndex(m => m.id === media.id);
      setImageViewerIndex(imageIndex >= 0 ? imageIndex : 0);
      setImageViewerVisible(true);
    }
  }, [filteredMedia]);

  // Handle media long press (delete/move)
  const handleMediaLongPress = useCallback((media: EstimateMedia) => {
    if (readOnly) return;
    setMediaToDelete(media);
    setShowDeleteModal(true);
  }, [readOnly]);

  // Get line item name for a media item
  const getLineItemNameForMedia = useCallback((mediaId: string): string | null => {
    const lineItems = activeEstimate?.lineItems || draftEstimate?.lineItems || [];
    const lineItem = lineItems.find(li => li.mediaIds?.includes(mediaId));
    return lineItem?.description || null;
  }, [activeEstimate, draftEstimate]);

  // Render media item
  const renderMediaItem = useCallback(({ item, index }: { item: EstimateMedia; index: number }) => {
    const lineItemName = getLineItemNameForMedia(item.id);

    // Debug: Log media item to see what URIs are present
    console.log('[Gallery] Rendering media item:', {
      id: item.id,
      type: item.type,
      uri: item.uri,
      thumbnailUri: item.thumbnailUri,
      webUrl: (item as any).webUrl,
      thumbUrl: (item as any).thumbUrl,
      s3Key: item.s3Key,
    });

    // Resolve the URI - try multiple possible fields
    const imageUri = (item as any).webUrl || item.uri || (item as any).url;
    const thumbUri = (item as any).thumbUrl || item.thumbnailUri || (item as any).thumbnailUrl;
    const displayUri = item.type === 'video' ? (thumbUri || imageUri) : imageUri;

    return (
      <View style={[styles.mediaThumbContainer, {backgroundColor: colors.surface}]}>
        <TouchableOpacity
          style={styles.mediaThumb}
          onPress={() => handleMediaTap(item, index)}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: displayUri }}
            style={styles.mediaImage}
            resizeMode="cover"
          />
          {item.type === 'video' && (
            <View style={styles.videoOverlay}>
              <Icon name="play-circle" size={32} color="white" />
            </View>
          )}
          {/* Show line item name at bottom left */}
          {lineItemName && (
            <View style={styles.lineItemNameBadge}>
              <Text style={styles.lineItemNameText} numberOfLines={1}>
                {lineItemName}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        {!readOnly && (
          <TouchableOpacity
            style={[styles.deleteMediaBtn, {backgroundColor: colors.error}]}
            onPress={() => handleMediaLongPress(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="x" size={12} color="white" />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [handleMediaTap, handleMediaLongPress, readOnly, getLineItemNameForMedia]);

  // Render album chip
  const renderAlbumChip = useCallback((album: EstimateAlbum | null, label?: string) => {
    const isSelected = album ? selectedAlbumId === album.id : selectedAlbumId === null;
    const displayLabel = label || album?.name || 'All';
    const count = album
      ? (draftEstimate?.media || []).filter(m => m.albumId === album.id).length || 0
      : (draftEstimate?.media || []).length || 0;

    return (
      <TouchableOpacity
        key={album?.id || 'all'}
        style={[styles.albumChip, {backgroundColor: colors.surface, borderColor: colors.border}, isSelected && {backgroundColor: colors.accent, borderColor: colors.accent}]}
        onPress={() => setSelectedAlbumId(album?.id || null)}
        onLongPress={() => {
          if (!readOnly && album && album.name !== DEFAULT_ALBUM_NAME) {
            Alert.alert(
              'Delete Album',
              `Delete "${album.name}"? Media will be moved to ${DEFAULT_ALBUM_NAME}.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    if (selectedAlbumId === album.id) {
                      setSelectedAlbumId(null);
                    }
                    deleteAlbum(album.id);
                  },
                },
              ]
            );
          }
        }}
      >
        <Text style={[styles.albumChipText, {color: colors.textSecondary}, isSelected && {color: colors.textLight}]}>
          {displayLabel} ({count})
        </Text>
      </TouchableOpacity>
    );
  }, [selectedAlbumId, activeEstimate?.media, readOnly, deleteAlbum, colors]);

  if (!activeEstimate) {
    return null;
  }

  return (
    <View style={styles.container} >
      {/* Header */}
      < View style={styles.header} >
        <View style={styles.headerLeft}>
          <Text style={[styles.title, {color: colors.text}]}>Gallery</Text>
          <Text style={[styles.count, {color: colors.textSecondary}]}>{(activeEstimate.media || []).length} items</Text>
        </View>
      </View >

      {/* Album chips - only show if there are custom albums */}
      {
        albums.length > 1 && (
          <View style={styles.albumsRow}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={albums.filter(a => a.name !== DEFAULT_ALBUM_NAME)}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => renderAlbumChip(item)}
              contentContainerStyle={styles.albumsList}
            />
          </View>
        )
      }

      {/* Media Grid with Add Placeholder */}
      <TouchableOpacity
        style={styles.galleryContainer}
        onPress={!readOnly ? showAddMediaSheet : undefined}
        activeOpacity={readOnly ? 1 : 0.7}
        disabled={isLoading}
      >
        {filteredMedia.length > 0 ? (
          <FlatList
            data={filteredMedia}
            keyExtractor={(item) => item.id}
            renderItem={renderMediaItem}
            numColumns={GRID_COLUMNS}
            columnWrapperStyle={styles.gridRow}
            scrollEnabled={false}
            ListFooterComponent={
              !readOnly ? (
                <View style={styles.addMoreHint}>
                  {isUploading ? (
                    <View style={styles.inlineUploadProgress}>
                      <ActivityIndicator size="small" color={colors.accent} />
                      <Text style={[styles.inlineUploadText, {color: colors.text}]}>{uploadProgress}</Text>
                      {uploadPercentage > 0 && (
                        <View style={[styles.inlineProgressBar, {backgroundColor: colors.surface}]}>
                          <View style={[styles.inlineProgressFill, {backgroundColor: colors.accent, width: `${uploadPercentage}%`}]} />
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={[styles.addMoreText, {color: colors.textSecondary}]}>Tap anywhere to add more photos</Text>
                  )}
                </View>
              ) : null
            }
          />
        ) : (
          <View style={[styles.emptyState, {backgroundColor: colors.surface}]}>
            <Icon name="camera" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, {color: colors.text}]}>
              {readOnly ? 'No photos or videos' : 'Add Photos & Videos'}
            </Text>
            {!readOnly && (
              <Text style={[styles.emptySubtext, {color: colors.textSecondary}]}>Tap anywhere to get started</Text>
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* Image Viewer */}
      <ImageViewing
        images={viewerImages}
        imageIndex={imageViewerIndex}
        visible={imageViewerVisible}
        onRequestClose={() => setImageViewerVisible(false)}
      />

      {/* Video Player Modal */}
      <Modal
        visible={videoPlayerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setVideoPlayerVisible(false)}
      >
        <View style={styles.videoModal}>
          <TouchableOpacity
            style={[styles.videoCloseBtn, {backgroundColor: colors.surface}]}
            onPress={() => setVideoPlayerVisible(false)}
          >
            <Icon name="x" size={28} color="white" />
          </TouchableOpacity>
          {selectedVideo && (
            <View style={styles.videoPlayerContainer}>
              <Video
                source={{
                  uri: (selectedVideo as any).webUrl || selectedVideo.uri || (selectedVideo as any).url
                }}
                style={styles.videoPlayer}
                controls={true}
                resizeMode="contain"
                paused={false}
                onError={(error: any) => {
                  console.error('[Gallery] Video playback error:', error);
                  Alert.alert('Video Error', 'Unable to play video. The video may still be processing or the format is not supported.');
                }}
                onBuffer={({ isBuffering }: { isBuffering: boolean }) => {
                  console.log('[Gallery] Video buffering:', isBuffering);
                }}
              />
            </View>
          )}
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={[styles.deleteModalContent, {backgroundColor: colors.surface}]}>
            <View style={[styles.deleteIconWrap, {backgroundColor: `${colors.error}15`}]}>
              <Icon name="trash-2" size={32} color={colors.error} />
            </View>
            <Text style={[styles.deleteTitle, {color: colors.text}]}>Delete Media?</Text>
            <Text style={[styles.deleteSubtext, {color: colors.textSecondary}]}>This action cannot be undone.</Text>
            <View style={styles.deleteButtons}>
              <TouchableOpacity
                style={[styles.deleteCancelBtn, {backgroundColor: colors.surface}]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setMediaToDelete(null);
                }}
              >
                <Text style={[styles.deleteCancelText, {color: colors.textSecondary}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, {backgroundColor: colors.error}]}
                onPress={() => {
                  if (mediaToDelete) {
                    removeMedia(mediaToDelete.id);
                  }
                  setShowDeleteModal(false);
                  setMediaToDelete(null);
                }}
              >
                <Text style={[styles.deleteConfirmText, {color: colors.textLight}]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upload progress is now shown inline in the gallery */}
    </View >
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,

  },
  count: {
    fontSize: theme.fontSize.sm,

  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,

    borderRadius: theme.borderRadius.md,
  },
  addButtonText: {
    fontSize: theme.fontSize.sm,

    fontWeight: theme.fontWeight.medium,
  },
  albumsRow: {
    marginBottom: theme.spacing.sm,
  },
  albumsList: {
    gap: theme.spacing.xs,
  },
  albumChip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,

    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing.xs,
  },
  albumChipSelected: {
  },
  albumChipText: {
    fontSize: theme.fontSize.sm,

  },
  albumChipTextSelected: {

    fontWeight: theme.fontWeight.medium,
  },
  newAlbumChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,

    borderStyle: 'dashed',
    borderRadius: theme.borderRadius.full,
  },
  newAlbumText: {
    fontSize: theme.fontSize.sm,

  },
  gridRow: {
    paddingHorizontal: GALLERY_PADDING,
    gap: GRID_SPACING,
    marginBottom: GRID_SPACING,
    justifyContent: 'flex-start',
  },
  mediaThumbContainer: {
    position: 'relative',
  },
  mediaThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',

  },
  deleteMediaBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,

    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,

    zIndex: 10,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,

    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineItemNameBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  lineItemNameText: {
    fontSize: 9,
    color: 'white',
    fontWeight: '500',
  },
  galleryContainer: {
    minHeight: 120,
  },
  emptyState: {

    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: 2,

    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,

    textAlign: 'center',
  },
  emptyText: {
    fontSize: theme.fontSize.sm,

    textAlign: 'center',
  },
  addMoreHint: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  addMoreText: {
    fontSize: theme.fontSize.sm,
    fontStyle: 'italic',
  },
  inlineUploadProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  inlineUploadText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  inlineProgressBar: {
    width: 100,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  inlineProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  videoModal: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
  },
  videoCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  videoPreviewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayerContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
  },
  videoPreviewImage: {
    width: '100%',
    height: 300,
  },
  videoPreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  videoPreviewText: {
    color: 'white',
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    marginTop: theme.spacing.md,
  },
  videoPreviewSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalContent: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,

    marginBottom: theme.spacing.md,
  },
  modalInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,

    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    fontSize: theme.fontSize.xs,

    marginBottom: 2,
  },
  inputText: {
    fontSize: theme.fontSize.md,

  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  modalCancelBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  modalCancelText: {
    fontSize: theme.fontSize.md,

  },
  // Add Media Modal styles
  addMediaModalContent: {

    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  addMediaOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,

  },
  addMediaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,

    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  addMediaOptionText: {
    fontSize: theme.fontSize.md,

    flex: 1,
  },
  addMediaOptionHint: {
    fontSize: theme.fontSize.xs,

  },
  addMediaCancelBtn: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  addMediaCancelText: {
    fontSize: theme.fontSize.md,

    fontWeight: theme.fontWeight.medium,
  },
  // Delete Modal styles
  deleteModalContent: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  deleteIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,

    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  deleteTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,

    marginBottom: theme.spacing.xs,
  },
  deleteSubtext: {
    fontSize: theme.fontSize.sm,

    marginBottom: theme.spacing.lg,
  },
  deleteButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
  },
  deleteCancelBtn: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,

    alignItems: 'center',
  },
  deleteCancelText: {
    fontSize: theme.fontSize.md,

    fontWeight: theme.fontWeight.medium,
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,

    alignItems: 'center',
  },
  deleteConfirmText: {
    fontSize: theme.fontSize.md,

    fontWeight: theme.fontWeight.medium,
  },
  // Upload Progress Modal styles
  uploadModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadModalContent: {

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
  },
  uploadModalTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  uploadModalPercentage: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,

    marginTop: theme.spacing.xs,
  },
  uploadModalSubtext: {
    fontSize: theme.fontSize.sm,

    marginTop: theme.spacing.xs,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,

    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    marginTop: theme.spacing.md,
  },
  progressBar: {
    height: '100%',

    borderRadius: theme.borderRadius.full,
  },
});

export default EstimateGallery;
