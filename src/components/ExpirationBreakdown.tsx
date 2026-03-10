import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, ScrollView, TouchableWithoutFeedback } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import type { InventoryBatchRM } from '../types/apiResponses';
import { inventoryService, InventoryUsageHistoryRM } from '../services/api/domain/inventory/inventoryService';

interface ExpirationBreakdownProps {
  batches: InventoryBatchRM[];
  visible: boolean;
  onClose: () => void;
  itemTitle: string;
  loading?: boolean;
  inventoryId?: string;
}

export const ExpirationBreakdown: React.FC<ExpirationBreakdownProps> = ({
  batches,
  visible,
  onClose,
  itemTitle,
  loading = false,
  inventoryId,
}) => {
  const {colors} = useTheme();
  const [usageHistory, setUsageHistory] = useState<InventoryUsageHistoryRM[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'batches' | 'history'>('batches');

  // Load usage history when modal opens
  useEffect(() => {
    if (visible && inventoryId) {
      setLoadingHistory(true);
      inventoryService.getUsageHistory(inventoryId)
        .then(history => {
          setUsageHistory(history);
        })
        .catch(err => {
          console.error('[ExpirationBreakdown] Error loading usage history:', err);
          setUsageHistory([]);
        })
        .finally(() => {
          setLoadingHistory(false);
        });
    } else if (!visible) {
      setUsageHistory([]);
      setActiveTab('batches');
    }
  }, [visible, inventoryId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getExpirationStatus = (batch: InventoryBatchRM) => {
    if (batch.isExpired) {
      return { label: 'Expired', color: colors.error };
    } else if (batch.daysUntilExpiration <= 3) {
      return { label: `${batch.daysUntilExpiration}d left`, color: colors.warning };
    } else {
      return { label: `${batch.daysUntilExpiration}d left`, color: colors.textSecondary };
    }
  };

  const totalQuantity = batches.reduce((sum, b) => sum + b.quantityRemaining, 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlayBackground} />
        </TouchableWithoutFeedback>
        <View style={[styles.modalContainer, {backgroundColor: colors.surface}]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Icon name="clock" size={20} color={colors.accent} />
              <Text style={[styles.title, {color: colors.text}]}>Expiration Breakdown</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, {backgroundColor: colors.accent, borderRadius: 14}]}>
              <Icon name="x" size={20} color={colors.textLight} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.itemTitle, {color: colors.text}]}>{itemTitle}</Text>
          <Text style={[styles.totalQuantity, {color: colors.textSecondary}]}>Total: {totalQuantity} units</Text>

          {/* Tabs */}
          <View style={[styles.tabContainer, {backgroundColor: colors.background}]}>
            <TouchableOpacity 
              style={[styles.tab, {backgroundColor: colors.surface}, activeTab === 'batches' && [styles.tabActive, {backgroundColor: colors.accent}]]}
              onPress={() => setActiveTab('batches')}
            >
              <Icon name="layers" size={16} color={activeTab === 'batches' ? colors.textLight : colors.textSecondary} />
              <Text style={[styles.tabText, {color: colors.textSecondary}, activeTab === 'batches' && [styles.tabTextActive, {color: colors.textLight}]]}>Batches</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, {backgroundColor: colors.surface}, activeTab === 'history' && [styles.tabActive, {backgroundColor: colors.accent}]]}
              onPress={() => setActiveTab('history')}
            >
              <Icon name="activity" size={16} color={activeTab === 'history' ? colors.textLight : colors.textSecondary} />
              <Text style={[styles.tabText, {color: colors.textSecondary}, activeTab === 'history' && [styles.tabTextActive, {color: colors.textLight}]]}>History</Text>
              {usageHistory.length > 0 && (
                <View style={[styles.historyBadge, {backgroundColor: colors.accent}]}>
                  <Text style={[styles.historyBadgeText, {color: colors.textLight}]}>{usageHistory.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.listContainer}>
            <ScrollView 
              style={styles.batchList}
              contentContainerStyle={styles.batchListContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
            {activeTab === 'batches' ? (
              <>
                {loading ? (
                  <View style={styles.emptyState}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={[styles.emptyText, {color: colors.textSecondary}]}>Loading batches...</Text>
                  </View>
                ) : batches.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Icon name="info" size={40} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, {color: colors.textSecondary}]}>No batches available</Text>
                  </View>
                ) : (
                  batches.map((batch) => {
                    const status = getExpirationStatus(batch);
                    return (
                      <View key={batch.id} style={[styles.batchCard, {backgroundColor: colors.surface}]}>
                        <View style={styles.batchHeader}>
                          <Text style={[styles.batchQuantity, {color: colors.text}]}>
                            {batch.quantityRemaining} units
                          </Text>
                          <View style={[styles.statusBadge, {backgroundColor: colors.surface}, { borderColor: status.color }]}>
                            <Text style={[styles.statusText, { color: status.color }]}>
                              {status.label}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.batchDetails}>
                          <View style={styles.detailRow}>
                            <Icon name="plus" size={14} color={colors.textSecondary} />
                            <Text style={[styles.detailLabel, {color: colors.textSecondary}]}>Added:</Text>
                            <Text style={[styles.detailValue, {color: colors.text}]}>{formatDate(batch.addedAt)}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Icon name="alert-circle" size={14} color={colors.textSecondary} />
                            <Text style={[styles.detailLabel, {color: colors.textSecondary}]}>Expires:</Text>
                            <Text style={[styles.detailValue, {color: colors.text}]}>{formatDate(batch.expiresAt)}</Text>
                          </View>
                          {batch.quantityAdded !== batch.quantityRemaining && (
                            <View style={styles.detailRow}>
                              <Icon name="trending-down" size={14} color={colors.textSecondary} />
                              <Text style={[styles.detailLabel, {color: colors.textSecondary}]}>Used:</Text>
                              <Text style={[styles.detailValue, {color: colors.text}]}>
                                {batch.quantityAdded - batch.quantityRemaining} units
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </>
            ) : (
              <>
                {loadingHistory ? (
                  <View style={styles.emptyState}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={[styles.emptyText, {color: colors.textSecondary}]}>Loading history...</Text>
                  </View>
                ) : usageHistory.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Icon name="inbox" size={40} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, {color: colors.textSecondary}]}>No usage history</Text>
                  </View>
                ) : (
                  usageHistory.map((record) => (
                    <View key={record.id} style={[styles.historyCard, {backgroundColor: colors.surface}]}>
                      <View style={styles.historyHeader}>
                        <View style={styles.historyAction}>
                          <Icon 
                            name={record.actionType === 'used' ? 'minus-circle' : record.actionType === 'returned' ? 'plus-circle' : 'package'} 
                            size={18} 
                            color={record.actionType === 'used' ? colors.error : record.actionType === 'returned' ? colors.success : colors.accent} 
                          />
                          <Text style={[
                            styles.historyActionText,
                            { color: record.actionType === 'used' ? colors.error : record.actionType === 'returned' ? colors.success : colors.accent }
                          ]}>
                            {record.actionType === 'used' ? 'Used' : record.actionType === 'returned' ? 'Returned' : 'Added'}
                          </Text>
                        </View>
                        <Text style={[styles.historyQuantity, {color: colors.text}]}>
                          {record.actionType === 'used' ? '-' : '+'}{record.quantity} units
                        </Text>
                      </View>
                      <View style={styles.historyDetails}>
                        <Text style={[styles.historyDate, {color: colors.textSecondary}]}>{formatDate(record.createDatetime)}</Text>
                        <Text style={[styles.historyChange, {color: colors.textSecondary}]}>
                          {record.previousQuantity} → {record.newQuantity}
                        </Text>
                      </View>
                      {record.jobTitle && (
                        <View style={styles.historyJob}>
                          <Icon name="briefcase" size={12} color={colors.textSecondary} />
                          <Text style={[styles.historyJobText, {color: colors.textSecondary}]}>{record.jobTitle}</Text>
                        </View>
                      )}
                      {record.notes && (
                        <Text style={[styles.historyNotes, {color: colors.textSecondary}]}>{record.notes}</Text>
                      )}
                    </View>
                  ))
                )}
              </>
            )}
            </ScrollView>
          </View>

          <TouchableOpacity style={[styles.closeFooterButton, {backgroundColor: colors.surface}]} onPress={onClose}>
            <Text style={[styles.closeFooterButtonText, {color: colors.accent}]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',

    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
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
  closeButton: {
    padding: theme.spacing.xs,
  },
  itemTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,

    marginBottom: theme.spacing.xs,
  },
  totalQuantity: {
    fontSize: theme.fontSize.sm,

    marginBottom: theme.spacing.sm,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.md,

    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  tabActive: {
  },
  tabText: {
    fontSize: theme.fontSize.sm,

    fontWeight: theme.fontWeight.medium,
  },
  tabTextActive: {
  },
  historyBadge: {

    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  historyBadgeText: {
    fontSize: theme.fontSize.xs,

    fontWeight: theme.fontWeight.semibold,
  },
  listContainer: {
    minHeight: 200,
    maxHeight: 400,
    marginBottom: theme.spacing.sm,
  },
  batchList: {
    flex: 1,
  },
  batchListContent: {
    paddingBottom: theme.spacing.xs,
    flexGrow: 1,
  },
  batchCard: {

    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,

  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  batchQuantity: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
  },
  statusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
  },
  batchDetails: {
    gap: theme.spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  detailLabel: {
    fontSize: theme.fontSize.sm,

  },
  detailValue: {
    fontSize: theme.fontSize.sm,

    fontWeight: theme.fontWeight.medium,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    fontSize: theme.fontSize.md,

    marginTop: theme.spacing.sm,
  },
  closeFooterButton: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,

    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  closeFooterButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  historyCard: {

    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,

  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  historyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  historyActionText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  historyQuantity: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,

  },
  historyDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  historyDate: {
    fontSize: theme.fontSize.xs,

  },
  historyChange: {
    fontSize: theme.fontSize.xs,

  },
  historyJob: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  historyJobText: {
    fontSize: theme.fontSize.xs,

  },
  historyNotes: {
    fontSize: theme.fontSize.xs,

    fontStyle: 'italic',
    marginTop: theme.spacing.xs,
  },
});
