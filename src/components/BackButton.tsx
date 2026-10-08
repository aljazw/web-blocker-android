import { Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import Icon from './Icon';

/** Round "back" button for the left side of a screen header. */
const BackButton: React.FC = () => {
    const { theme } = useTheme();
    const navigation = useNavigation();

    return (
        <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={[styles.button, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Icon name="Back" size={20} />
        </Pressable>
    );
};

const styles = StyleSheet.create({
    button: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
});

export default BackButton;
