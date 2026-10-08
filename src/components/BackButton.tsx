import { useNavigation } from '@react-navigation/native';
import { StyleSheet } from 'react-native';
import { spacing } from '../theme';
import IconButton from './IconButton';

/** "Back" button for the left side of a screen header. */
const BackButton: React.FC<{ onPress?: () => void }> = ({ onPress }) => {
    const navigation = useNavigation();
    return (
        <IconButton
            icon="Back"
            variant="outline"
            accessibilityLabel="Back"
            onPress={onPress ?? (() => navigation.goBack())}
            style={styles.button}
        />
    );
};

const styles = StyleSheet.create({
    button: {
        marginRight: spacing.md - 4,
    },
});

export default BackButton;
