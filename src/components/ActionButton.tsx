import { Pressable, StyleSheet, Text, ViewStyle } from "react-native"

type ActionVariant = 'cancel' | 'confirm';

const variantConfig: Record<ActionVariant, { title: string; color: string }> = {
    cancel: { title: 'Cancel', color: '#f44336'},
    confirm: {title: 'Confirm', color: '#4CAF50'}
};

interface CancelButtonProps {
    variant: ActionVariant;
    style?: ViewStyle;
    onPress: () => void;
}

const ActionButton: React.FC<CancelButtonProps> = ({variant, style, onPress}) => {

    const config = variantConfig[variant];

    return (
        <Pressable style={[styles.cancelButton, { backgroundColor: config.color }, style]} onPress={onPress}>
            <Text style={styles.buttonText}>{config.title}</Text>
        </Pressable>
    );
};


const styles = StyleSheet.create({
    cancelButton: {
        backgroundColor: '#f44336',
        padding: 10,
        borderRadius: 5,
        marginRight: 10,
        width: 80,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    
});

export default ActionButton;