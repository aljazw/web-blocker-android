import { StyleSheet } from 'react-native';
import ActionButton from './ActionButton';
import BlurModal from './BlurModal';
import { ThemedText } from './ThemedText';
import { spacing } from '../theme';

interface ErrorPopupProps {
    title: string;
    text: string;
    visible: boolean;
    onClose: () => void;
}

const ErrorPopup: React.FC<ErrorPopupProps> = ({ title, text, visible, onClose }) => {
    return (
        <BlurModal visible={visible} onClose={onClose}>
            <ThemedText style={styles.title} color="primaryRed" weight="strong">
                {title}
            </ThemedText>
            <ThemedText align="center" size="small" style={styles.text}>
                {text}
            </ThemedText>
            <ActionButton variant="cancel" onPress={onClose} />
        </BlurModal>
    );
};

const styles = StyleSheet.create({
    title: {
        marginBottom: spacing.sm,
    },
    text: {
        marginBottom: spacing.lg,
    },
});

export default ErrorPopup;
