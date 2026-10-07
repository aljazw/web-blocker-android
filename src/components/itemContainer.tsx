import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { shapes, spacing } from '../theme';
import { ThemedView } from './ThemedView';

interface ItemContainerProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

/** Rounded card used for list rows. */
const ItemContainer: React.FC<ItemContainerProps> = ({ children, style }) => {
    return (
        <ThemedView withBorder style={[styles.itemContainer, style]}>
            {children}
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    itemContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        paddingVertical: 14,
        paddingHorizontal: spacing.md,
        borderRadius: shapes.borderRadius.medium,
    },
});

export default ItemContainer;
