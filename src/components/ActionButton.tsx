import { StyleSheet, ViewStyle } from 'react-native';
import Button from './Button';

type ActionVariant = 'cancel' | 'confirm';

interface ActionButtonProps {
    variant: ActionVariant;
    label?: string;
    style?: ViewStyle;
    onPress: () => void;
}

/** Cancel / Confirm pair used at the bottom of popups. */
const ActionButton: React.FC<ActionButtonProps> = ({ variant, label, style, onPress }) => (
    <Button
        compact
        variant={variant === 'confirm' ? 'primary' : 'ghost'}
        label={label ?? (variant === 'confirm' ? 'Confirm' : 'Cancel')}
        onPress={onPress}
        style={[styles.button, style]}
    />
);

const styles = StyleSheet.create({
    button: {
        minWidth: 116,
        marginHorizontal: 6,
        minHeight: 46,
    },
});

export default ActionButton;
