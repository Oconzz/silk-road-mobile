import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../theme';
import { useTheme } from '../context/ThemeContext';

interface CredentialsModalProps {
  visible: boolean;
  onClose: () => void;
  fullName?: string;
  email?: string;
  temporaryPassword?: string;
  isNewUser?: boolean;
}

export const CredentialsModal: React.FC<CredentialsModalProps> = ({
  visible,
  onClose,
  fullName,
  email,
  temporaryPassword,
  isNewUser = true,
}) => {
  const {colors} = useTheme();
  const credentialsText = `
Silk Road App - Team Member Credentials

Name: ${fullName || 'N/A'}
Email: ${email || 'N/A'}
Temporary Password: ${temporaryPassword || 'N/A'}

Please login at the Silk Road app and change your password after first login.
`.trim();

  const handleShare = async () => {
    try {
      await Share.share({
        message: credentialsText,
        title: 'Team Member Credentials',
      });
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share credentials.');
    }
  };

  if (!isNewUser) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <View style={[styles.container, {backgroundColor: colors.surface}]}>
            <View style={styles.header}>
              <View style={[styles.iconContainer, {backgroundColor: `${colors.accent}15`}]}>
                <Icon name="user-check" size={32} color={colors.success} />
              </View>
              <Text style={[styles.title, {color: colors.text}]}>Existing User Added</Text>
              <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
                {fullName || email} already has an account and has been added to your company.
              </Text>
            </View>

            <TouchableOpacity style={[styles.primaryButton, {backgroundColor: colors.accent}]} onPress={onClose}>
              <Text style={styles.primaryButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, {backgroundColor: colors.surface}]}>
          <View style={styles.header}>
            <View style={[styles.iconContainer, {backgroundColor: `${colors.accent}15`}]}>
              <Icon name="user-plus" size={32} color={colors.success} />
            </View>
            <Text style={[styles.title, {color: colors.text}]}>Team Member Created!</Text>
            <Text style={[styles.subtitle, {color: colors.textSecondary}]}>
              Share these credentials with {fullName || 'the team member'} so they can login.
            </Text>
          </View>

          <View style={[styles.credentialsCard, {backgroundColor: colors.surface}]}>
            <View style={styles.credentialRow}>
              <View style={styles.credentialInfo}>
                <Text style={[styles.credentialLabel, {color: colors.textSecondary}]}>Email</Text>
                <Text style={[styles.credentialValue, {color: colors.text}]} selectable>{email || 'N/A'}</Text>
              </View>
            </View>

            <View style={[styles.divider, {backgroundColor: colors.divider}]} />

            <View style={styles.credentialRow}>
              <View style={styles.credentialInfo}>
                <Text style={[styles.credentialLabel, {color: colors.textSecondary}]}>Temporary Password</Text>
                <Text style={[styles.credentialValue, {color: colors.text}, styles.passwordValue]} selectable>
                  {temporaryPassword || 'N/A'}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.warningBanner, {backgroundColor: `${colors.warning}15`}]}>
            <Icon name="alert-triangle" size={16} color={colors.warning} />
            <Text style={[styles.warningText, {color: colors.warning}]}>
              The user should change their password after first login.
            </Text>
          </View>

          <TouchableOpacity style={[styles.shareButton, {backgroundColor: colors.accent}]} onPress={handleShare}>
            <Icon name="share-2" size={18} color="#fff" />
            <Text style={styles.shareButtonText}>Share Credentials</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.closeButton, {backgroundColor: colors.accent}]} onPress={onClose}>
            <Text style={[styles.closeButtonText, {color: colors.textLight}]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {

    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,

    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',

    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,

    textAlign: 'center',
    lineHeight: 20,
  },
  credentialsCard: {

    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  credentialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  credentialInfo: {
    flex: 1,
  },
  credentialLabel: {
    fontSize: 12,

    marginBottom: 4,
  },
  credentialValue: {
    fontSize: 16,
    fontWeight: '600',

  },
  passwordValue: {
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  copyBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,

    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  divider: {
    height: 1,

    marginVertical: 12,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',

    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,

  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,

    gap: 8,
    marginBottom: 8,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600',

  },
  primaryButton: {

    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
