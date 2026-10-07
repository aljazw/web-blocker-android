import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import Button from './Button';

interface NextButtonProps {
    onPress: () => void;
    label?: string;
    buttonContainer?: object;
}

const NextButton: React.FC<NextButtonProps> = ({ onPress, label = 'Continue', buttonContainer = {} }) => (
    <View style={[styles.container, buttonContainer]}>
        <Button label={label} icon="ArrowRight" onPress={onPress} />
    </View>
);

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: spacing.md,
        marginTop: spacing.lg,
    },
});

export default NextButton;
