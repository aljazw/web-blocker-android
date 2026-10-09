import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import { shapes, spacing } from '../theme';
import { ThemedView } from './ThemedView';
import { useTheme } from '../context/ThemeContext';

interface ModalPanelProps {
    children: ReactNode;
    visible: boolean;
    onClose: () => void;
    /** Close when the dimmed backdrop is tapped. */
    dismissable?: boolean;
}

/**
 * Centered panel over a dimmed backdrop. The base of every dialog. A plain
 * scrim instead of a live blur: blurring the screen behind on Android costs
 * whole frames on every open, which made dialogs feel sluggish.
 */
const ModalPanel: React.FC<ModalPanelProps> = ({ children, visible, onClose, dismissable = true }) => {
    const { isDarkMode } = useTheme();

    return (
        <Modal
            animationType="fade"
            transparent
            visible={visible}
            onRequestClose={onClose}
            statusBarTranslucent
            navigationBarTranslucent
            hardwareAccelerated>
            <Pressable
                style={[styles.scrim, isDarkMode ? styles.scrimDark : styles.scrimLight]}
                onPress={dismissable ? onClose : undefined}
                accessibilityLabel="Close"
            />
            <KeyboardAvoidingView behavior="height" style={styles.center} pointerEvents="box-none">
                <ThemedView withBorder style={styles.panel}>
                    <View>{children}</View>
                </ThemedView>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    scrim: {
        ...StyleSheet.absoluteFillObject,
    },
    scrimDark: {
        backgroundColor: 'rgba(0,0,0,0.62)',
    },
    scrimLight: {
        backgroundColor: 'rgba(10,12,16,0.42)',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    panel: {
        padding: spacing.lg,
        borderRadius: shapes.borderRadius.large,
        elevation: shapes.elevation.high,
        width: '90%',
        maxWidth: 440,
    },
});

export default ModalPanel;
