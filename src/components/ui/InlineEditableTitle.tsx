import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    Keyboard,
    Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { theme } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

export interface InlineEditableTitleProps {
    /** Current title value */
    value: string;
    /** Callback when title is saved */
    onSave: (newValue: string) => void;
    /** Placeholder when value is empty */
    placeholder?: string;
    /** Whether editing is disabled */
    disabled?: boolean;
    /** Maximum characters allowed */
    maxLength?: number;
    /** Font size for the title */
    fontSize?: number;
    /** Whether to auto-select text on edit start */
    selectAllOnFocus?: boolean;
    /** Optional icon to show next to edit indicator */
    editIcon?: string;
}

/**
 * InlineEditableTitle - Tap-to-edit title component
 * 
 * Used for:
 * - Estimate detail screen title
 * - Job detail screen title
 * - Template editing
 * 
 * Behavior:
 * - Tap on title → TextInput appears
 * - Blur or Enter → saves and returns to text display
 */
export const InlineEditableTitle: React.FC<InlineEditableTitleProps> = ({
    value,
    onSave,
    placeholder = 'Untitled',
    disabled = false,
    maxLength = 100,
    fontSize = theme.fontSize.xl,
    selectAllOnFocus = true,
    editIcon: _editIcon = false,
}) => {
    const {colors} = useTheme();
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const inputRef = useRef<TextInput>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Sync editValue with prop changes
    useEffect(() => {
        if (!isEditing) {
            setEditValue(value);
        }
    }, [value, isEditing]);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            if (selectAllOnFocus) {
                // Small delay to ensure focus first, then select all
                setTimeout(() => {
                    inputRef.current?.setSelection(0, editValue.length);
                }, 100);
            }
        }
    }, [isEditing, selectAllOnFocus]);

    // Animate edit icon visibility
    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: isEditing ? 0 : 1,
            duration: 150,
            useNativeDriver: true,
        }).start();
    }, [isEditing, fadeAnim]);

    // Start editing
    const handleStartEdit = useCallback(() => {
        if (disabled) return;
        setEditValue(value);
        setIsEditing(true);
    }, [disabled, value]);

    // Save and exit editing
    const handleSave = useCallback(() => {
        const trimmedValue = editValue.trim();
        const finalValue = trimmedValue || value; // Revert to original if empty

        setIsEditing(false);
        Keyboard.dismiss();

        if (finalValue !== value) {
            onSave(finalValue);
        }
        setEditValue(finalValue);
    }, [editValue, value, onSave]);

    // Cancel editing
    const handleCancel = useCallback(() => {
        setIsEditing(false);
        setEditValue(value);
        Keyboard.dismiss();
    }, [value]);

    // Handle key press (Enter to save, Escape to cancel)
    const handleKeyPress = useCallback((e: any) => {
        if (e.nativeEvent.key === 'Enter') {
            handleSave();
        }
    }, [handleSave]);

    if (isEditing) {
        return (
            <View style={[styles.editContainer, {backgroundColor: colors.background, borderColor: colors.accent}]}>
                <TextInput
                    ref={inputRef}
                    style={[styles.input, { fontSize, color: colors.text }]}
                    value={editValue}
                    onChangeText={setEditValue}
                    onBlur={handleSave}
                    onSubmitEditing={handleSave}
                    onKeyPress={handleKeyPress}
                    placeholder={placeholder}
                    placeholderTextColor={colors.gray}
                    maxLength={maxLength}
                    returnKeyType="done"
                    blurOnSubmit
                    autoCapitalize="sentences"
                    autoCorrect={false}
                />
                <View style={styles.editActions}>
                    <TouchableOpacity
                        style={[styles.editActionBtn, {backgroundColor: colors.background}]}
                        onPress={handleCancel}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Icon name="x" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.editActionBtn, styles.saveBtn, {backgroundColor: `${colors.accent}15`}]}
                        onPress={handleSave}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Icon name="check" size={18} color={colors.accent} />
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <TouchableOpacity
            style={styles.displayContainer}
            onPress={handleStartEdit}
            activeOpacity={disabled ? 1 : 0.7}
            disabled={disabled}
        >
            <Text
                style={[
                    styles.displayText,
                    { fontSize, color: colors.text },
                    !value && [styles.placeholder, {color: colors.gray}],
                ]}
                numberOfLines={2}
            >
                {value || placeholder}
            </Text>
            {!disabled && (
                <Animated.View style={[styles.editIndicator, { opacity: fadeAnim }]} />
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    displayContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.xs,
        paddingVertical: theme.spacing.xs,
        paddingRight: theme.spacing.lg, // Space for edit indicator
    },
    displayText: {
        flex: 1,
        fontWeight: theme.fontWeight.bold,

        lineHeight: 28,
    },
    placeholder: {

        fontStyle: 'italic',
    },
    editIndicator: {
        marginTop: 6,
        opacity: 0.6,
    },
    editContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,

        borderRadius: theme.borderRadius.md,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        borderWidth: 1,

    },
    input: {
        flex: 1,
        fontWeight: theme.fontWeight.bold,

        paddingVertical: theme.spacing.xs,
        minHeight: 40,
    },
    editActions: {
        flexDirection: 'row',
        gap: theme.spacing.xs,
    },
    editActionBtn: {
        padding: theme.spacing.xs,
        borderRadius: theme.borderRadius.sm,
    },
    saveBtn: {
  },
});

export default InlineEditableTitle;
