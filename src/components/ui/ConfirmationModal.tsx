import React, {memo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {theme} from '../../theme';
import {useTheme} from '../../context/ThemeContext';

export interface ModalButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  icon?: string;
  iconColor?: string;
  buttons: ModalButton[];
  onClose?: () => void;
}

export const ConfirmationModal = memo<ConfirmationModalProps>(
  ({visible, title, message, icon, iconColor, buttons, onClose}) => {
    const {colors} = useTheme();
    const handleBackdropPress = () => {
      const cancelButton = buttons.find(b => b.style === 'cancel');
      if (cancelButton) {
        cancelButton.onPress();
      } else if (onClose) {
        onClose();
      }
    };

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleBackdropPress}
      >
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContainer, {backgroundColor: colors.surface}]}>
                {icon && (
                  <View style={[styles.iconWrap, iconColor && {backgroundColor: iconColor + '20'}]}>
                    <Icon 
                      name={icon} 
                      size={32} 
                      color={iconColor || colors.accent} 
                    />
                  </View>
                )}
                
                <Text style={[styles.title, {color: colors.text}]}>{title}</Text>
                <Text style={[styles.message, {color: colors.textSecondary}]}>{message}</Text>
                
                <View style={styles.buttonsContainer}>
                  {buttons.map((button, index) => {
                    const isDestructive = button.style === 'destructive';
                    const isCancel = button.style === 'cancel';
                    const isPrimary = !isDestructive && !isCancel;
                    
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.button,
                          isPrimary && [styles.buttonPrimary, {backgroundColor: colors.accent}],
                          isDestructive && [styles.buttonDestructive, {backgroundColor: colors.error}],
                          isCancel && [styles.buttonCancel, {backgroundColor: colors.background, borderColor: colors.border}],
                        ]}
                        onPress={button.onPress}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.buttonText,
                            isPrimary && [styles.buttonTextPrimary, {color: colors.textLight}],
                            isDestructive && [styles.buttonTextDestructive, {color: colors.textLight}],
                            isCancel && [styles.buttonTextCancel, {color: colors.text}],
                          ]}
                        >
                          {button.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  },
);

ConfirmationModal.displayName = 'ConfirmationModal';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContainer: {

    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...theme.shadow.lg,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,

    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,

    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  message: {
    fontSize: theme.fontSize.md,

    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  buttonsContainer: {
    width: '100%',
    gap: theme.spacing.sm,
  },
  button: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
  },
  buttonDestructive: {
  },
  buttonCancel: {

    borderWidth: 1.5,

  },
  buttonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  buttonTextPrimary: {
  },
  buttonTextDestructive: {
  },
  buttonTextCancel: {
  },
});
