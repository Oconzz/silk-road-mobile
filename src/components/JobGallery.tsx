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
// theme imported via useTheme
import { useTheme } from '../context/ThemeContext';
import {
  pickImageFromLibrary,
  capturePhoto,
  pickVideoFromLibrary,
  recordVideo,
} from '../services/estimateMediaService';
import { uploadFile, EntityType } from '../services/mediaUploadService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_COLUMNS = 4;
const GRID_SPACING = 4;
const GALLERY_PADDING = 32;
const THUMB_SIZE = (SCREEN_WIDTH - (GALLERY_PADDING * 2) - (GRID_COLUMNS - 1) * GRID_SPACING) / GRID_COLUMNS;

type MediaCategory = 'general' | 'before' | 'after';

interface JobMedia {
  id: string;
  uri?: string;
  webUrl?: string;
  thumbUrl?: string;
  thumbnailUri?: string;
  type: string;
  category: string;
  mimeType: string;
  fileName?: string;
  sizeBytes?: number;
  s3Key?: string;
  albumId?: string;
  [key: string]: any;
}

interface JobGalleryProps {
  jobId: string;
  media: JobMedia[];
  readOnly?: boolean;
  onAddMedia?: (media: any) => void;
  onRemoveMedia?: (mediaId: string) => void;
}

const TABS: { key: MediaCategory; label: string; icon: string }[] = [
  { key: 'general', label: 'Estimate', icon: 'file-text' },
  { key: 'before', label: 'Before', icon: 'sunrise' },
  { key: 'after', label: 'After', icon: 'sunset' },
];

export const JobGallery: React.FC<JobGalleryProps> = ({
  jobId,
  media,
  readOnly = false,
  onAddMedia,
  onRemoveMedia,
}) => {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<MediaCategory>('general');
  const [isLoading, setIsLoading] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [videoPlayerVisible, setVideoPlayerVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<JobMedia | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [mediaToDelete, setMediaToDelete] = useState<JobMedia | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Filter media by active tab category
  const filteredMedia = useMemo(() => {
    return (media || []).filter(m => (m.category || 'general') === activeTab);
  }, [media, activeTab]);

  // Count per category
  const counts = useMemo(() => {
    const all = media || [];
    return {
      general: all.filter(m => (m.category || 'general') === 'general').length,
      before: all.filter(m => m.category === 'before').length,
      after: all.filter(m => m.category === 'after').length,
    };
  }, [media]);

  // Images for viewer
  const viewerImages = useMemo(() => {
    return filteredMedia
      .filter(m => m.type === 'image')
      .map(m => ({ uri: m.webUrl || m.uri || '' }))
      .filter(img => !!img.uri);
  }, [filteredMedia]);

  // Upload and add media with category
  const uploadAndAddMedia = useCallback(async (mediaItem: any) => {
    if (!onAddMedia) return;

    try {
      setUploadProgress('Uploading...');
      const result = await uploadFile(
        mediaItem.uri,
        'job' as EntityType,
        jobId,
        mediaItem.mimeType,
      );

      if (result.success && result.s3Key) {
        onAddMedia({
          ...mediaItem,
          s3Key: result.s3Key,
          category: activeTab,
          albumId: undefined,
        });
      } else {
        Alert.alert('Upload Failed', 'Failed to upload media. Please try again.');
      }
    } catch (error) {
      console.error('[JobGallery] Upload error:', error);
      Alert.alert('Error', 'An error occurred while uploading media.');
    } finally {
      setUploadProgress(null);
    }
  }, [jobId, activeTab, onAddMedia]);

  // Upload multiple
  const uploadAndAddMediaList = useCallback(async (mediaList: any[]) => {
    for (let i = 0; i < mediaList.length; i++) {
      setUploadProgress(`Uploading ${i + 1} of ${mediaList.length}...`);
      await uploadAndAddMedia(mediaList[i]);
    }
    setUploadProgress(null);
  }, [uploadAndAddMedia]);

  // Show add media action sheet
  const showAddMediaSheet = useCallback(() => {
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
              case 1:
                result = await capturePhoto(jobId, '');
                if (result?.media) await uploadAndAddMedia(result.media);
                break;
              case 2:
                result = await pickImageFromLibrary(jobId, '');
                if (result && 'mediaList' in result && result.mediaList) {
                  await uploadAndAddMediaList(result.mediaList);
                } else if (result?.media) {
                  await uploadAndAddMedia(result.media);
                }
                break;
              case 3:
                try {
                  result = await recordVideo(jobId, '');
                  if (result?.media) await uploadAndAddMedia(result.media);
                } catch {
                  Alert.alert('Camera Error', 'Unable to record video. Please try again.');
                }
                break;
              case 4:
                result = await pickVideoFromLibrary(jobId, '');
                if (result?.media) await uploadAndAddMedia(result.media);
                break;
            }
          } catch (error) {
            console.error('[JobGallery] Add media error:', error);
            Alert.alert('Error', 'Failed to add media');
          } finally {
            setIsLoading(false);
          }
        }
      );
    } else {
      Alert.alert(
        'Add Media',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Take Photo',
            onPress: async () => {
              setIsLoading(true);
              const result = await capturePhoto(jobId, '');
              if (result?.media) await uploadAndAddMedia(result.media);
              setIsLoading(false);
            },
          },
          {
            text: 'Choose Photos',
            onPress: async () => {
              setIsLoading(true);
              const result = await pickImageFromLibrary(jobId, '');
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
  }, [jobId, uploadAndAddMedia, uploadAndAddMediaList]);

  // Handle media tap
  const handleMediaTap = useCallback((item: JobMedia) => {
    if (item.type === 'video') {
      setSelectedVideo(item);
      setVideoPlayerVisible(true);
    } else {
      const imageIndex = filteredMedia
        .filter(m => m.type === 'image')
        .findIndex(m => m.id === item.id);
      setImageViewerIndex(imageIndex >= 0 ? imageIndex : 0);
      setImageViewerVisible(true);
    }
  }, [filteredMedia]);

  // Determine if current tab allows editing
  const canEdit = !readOnly && activeTab !== 'general' && !!onAddMedia;

  // Render media item
  const renderMediaItem = useCallback(({ item }: { item: JobMedia }) => {
    const imageUri = item.webUrl || item.uri || '';
    const thumbUri = item.thumbUrl || item.thumbnailUri || '';
    const displayUri = item.type === 'video' ? (thumbUri || imageUri) : imageUri;
    // Show linked line item / inventory label if available
    const itemLabel = item.jobInventoryTitle || item.estimateItemTitle || null;

    return (
      <View style={[styles.mediaThumbContainer, {backgroundColor: colors.surface}]}>
        <TouchableOpacity
          style={styles.mediaThumb}
          onPress={() => handleMediaTap(item)}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: displayUri }}
            style={styles.mediaImage}
            resizeMode="cover"
          />
          {item.type === 'video' && (
            <View style={styles.videoOverlay}>
              <Icon name="play-circle" size={28} color="white" />
            </View>
          )}
          {itemLabel && (
            <View style={styles.lineItemNameBadge}>
              <Text style={styles.lineItemNameText} numberOfLines={1}>
                {itemLabel}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        {canEdit && onRemoveMedia && (
          <TouchableOpacity
            style={styles.deleteMediaBtn}
            onPress={() => {
              setMediaToDelete(item);
              setShowDeleteModal(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="x" size={10} color="white" />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [handleMediaTap, canEdit, onRemoveMedia]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Icon name="image" size={18} color={colors.accent} />
          <Text style={[styles.title, { color: colors.text }]}>Gallery</Text>
          <Text style={[styles.count, { color: colors.textSecondary }]}>
            {(media || []).length}
          </Text>
        </View>
      </View>

      {/* Category Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: colors.divider }]}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const tabCount = counts[tab.key];
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                isActive && [styles.tabActive, { borderBottomColor: colors.accent }],
              ]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Icon
                name={tab.icon}
                size={14}
                color={isActive ? colors.accent : colors.textSecondary}
              />
              <Text
                style={[
                  styles.tabText,
                  { color: colors.textSecondary },
                  isActive && { color: colors.accent, fontWeight: '600' },
                ]}
              >
                {tab.label}
              </Text>
              {tabCount > 0 && (
                <View style={[
                  styles.tabBadge,
                  { backgroundColor: isActive ? colors.accent : colors.border },
                ]}>
                  <Text style={[
                    styles.tabBadgeText,
                    { color: isActive ? '#FFFFFF' : colors.textSecondary },
                  ]}>
                    {tabCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Upload Progress */}
      {uploadProgress && (
        <View style={[styles.uploadBar, { backgroundColor: `${colors.accent}15` }]}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.uploadText, { color: colors.accent }]}>{uploadProgress}</Text>
        </View>
      )}

      {/* Media Grid */}
      {filteredMedia.length > 0 ? (
        <TouchableOpacity
          style={styles.galleryContainer}
          onPress={canEdit ? showAddMediaSheet : undefined}
          activeOpacity={canEdit ? 0.7 : 1}
          disabled={isLoading || !canEdit}
        >
          <FlatList
            data={filteredMedia}
            keyExtractor={(item) => item.id}
            renderItem={renderMediaItem}
            numColumns={GRID_COLUMNS}
            columnWrapperStyle={styles.gridRow}
            scrollEnabled={false}
            ListFooterComponent={
              canEdit ? (
                <View style={styles.addMoreHint}>
                  <Text style={[styles.addMoreText, { color: colors.textSecondary }]}>
                    Tap to add more
                  </Text>
                </View>
              ) : null
            }
          />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.emptyState, { backgroundColor: `${colors.accent}08` }]}
          onPress={canEdit ? showAddMediaSheet : undefined}
          activeOpacity={canEdit ? 0.7 : 1}
          disabled={!canEdit}
        >
          <Icon
            name={activeTab === 'general' ? 'file-text' : activeTab === 'before' ? 'sunrise' : 'sunset'}
            size={32}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {activeTab === 'general'
              ? 'No estimate photos'
              : activeTab === 'before'
                ? 'No before photos yet'
                : 'No after photos yet'}
          </Text>
          {canEdit && (
            <View style={[styles.addButton, { backgroundColor: colors.accent }]}>
              <Icon name="plus" size={14} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add Photos</Text>
            </View>
          )}
          {activeTab === 'general' && !readOnly && (
            <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
              Photos added during estimate creation appear here
            </Text>
          )}
        </TouchableOpacity>
      )}

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
                source={{ uri: selectedVideo.webUrl || selectedVideo.uri || '' }}
                style={styles.videoPlayer}
                controls={true}
                resizeMode="contain"
                paused={false}
                onError={(error: any) => {
                  console.error('[JobGallery] Video playback error:', error);
                  Alert.alert('Video Error', 'Unable to play video.');
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
          <View style={[styles.deleteModalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.deleteIconWrap, { backgroundColor: `${colors.error}15` }]}>
              <Icon name="trash-2" size={28} color={colors.error} />
            </View>
            <Text style={[styles.deleteTitle, { color: colors.text }]}>Delete Media?</Text>
            <Text style={[styles.deleteSubtext, { color: colors.textSecondary }]}>
              This action cannot be undone.
            </Text>
            <View style={styles.deleteButtons}>
              <TouchableOpacity                 style={[styles.deleteCancelBtn, {backgroundColor: colors.surface}, { borderColor: colors.border }]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setMediaToDelete(null);
                }}
              >
                <Text style={[styles.deleteCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, { backgroundColor: colors.error }]}
                onPress={() => {
                  if (mediaToDelete && onRemoveMedia) {
                    onRemoveMedia(mediaToDelete.id);
                  }
                  setShowDeleteModal(false);
                  setMediaToDelete(null);
                }}
              >
                <Text style={styles.deleteConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  count: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 5,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tabBadge: {
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  // Upload
  uploadBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  uploadText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Gallery
  galleryContainer: {
    minHeight: 60,
  },
  gridRow: {
    gap: GRID_SPACING,
    marginBottom: GRID_SPACING,
  },
  mediaThumbContainer: {
    position: 'relative',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  mediaThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  deleteMediaBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
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
  addMoreHint: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  addMoreText: {
    fontSize: 12,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 4,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  // Video modal
  videoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoCloseBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  videoPlayerContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
  },
  videoPlayer: {
    flex: 1,
  },
  // Delete modal
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  deleteModalContent: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  deleteIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  deleteSubtext: {
    fontSize: 14,
    marginBottom: 20,
  },
  deleteButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  deleteCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
