import { StyleSheet, View, ViewStyle } from "react-native";
import { shapes, spacing, useTheme } from "../theme";

interface ItemContainerProps {
    children: React.ReactNode;
    style?: ViewStyle;
}

const ItemContainer: React.FC<ItemContainerProps> = ({children, style}) => {
    const { theme } = useTheme();

    return <View style={[styles.itemContainer, style, {backgroundColor: theme.colors.card, borderColor: theme.colors.border}]}>{children}</View>
};


const styles = StyleSheet.create({
    itemContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: spacing.sm,
        marginTop: spacing.md,
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: shapes.borderRadius.medium, 
        borderWidth: shapes.borderWidth.thin,  
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: shapes.elevation.medium, // Shadow effect for Android
    },
})

export default ItemContainer;
