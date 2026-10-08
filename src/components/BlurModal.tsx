import { BlurView } from '@react-native-community/blur';
import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import { shapes, spacing } from '../theme';
import { ThemedView } from './ThemedView';
import { useTheme } from '../context/ThemeContext';

interface BlurModalProps {
    children: ReactNode;
    visible: boolean;
    onClose: () => void;
    /** Close when the dimmed backdrop is tapped. */
    dismissable?: boolean;
}

/** Centered panel over a blurred, dimmed backdrop. The base of every dialog. */
const BlurModal: React.FC<BlurModalProps> = ({ children, visible, onClose, dismissable = true }) => {
    const { isDarkMode } = useTheme();

    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose} statusBarTranslucent>
            <BlurView blurType={isDarkMode ? 'dark' : 'light'} blurAmount={8} style={styles.fill}>
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
            </BlurView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    fill: {
        flex: 1,
    },
    scrim: {
        ...StyleSheet.absoluteFillObject,
    },
    scrimDark: {
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    scrimLight: {
        backgroundColor: 'rgba(10,12,16,0.25)',
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

export default BlurModal;
