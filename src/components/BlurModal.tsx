import { BlurView } from '@react-native-community/blur';
import { ReactNode } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { shapes, spacing } from '../theme';
import { ThemedView } from './ThemedView';
import { useTheme } from '../context/ThemeContext';

interface BlurModalProps {
    children: ReactNode;
    visible: boolean;
    onClose: () => void;
}

const BlurModal: React.FC<BlurModalProps> = ({ children, visible, onClose }) => {
    const { isDarkMode } = useTheme();

    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose} statusBarTranslucent>
            <BlurView blurType={isDarkMode ? 'dark' : 'light'} blurAmount={12} style={styles.blurContainer}>
                <View
                    style={[styles.scrim, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.35)' : 'rgba(17,21,39,0.15)' }]}
                />
                <ThemedView withBorder style={styles.popoutContainer}>
                    {children}
                </ThemedView>
            </BlurView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    blurContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrim: {
        ...StyleSheet.absoluteFillObject,
    },
    popoutContainer: {
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
        borderRadius: shapes.borderRadius.large,
        elevation: shapes.elevation.high,
        alignItems: 'center',
        width: '88%',
        maxWidth: 420,
    },
});

export default BlurModal;
