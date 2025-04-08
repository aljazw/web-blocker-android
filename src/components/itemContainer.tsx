import { StyleSheet, View, ViewStyle } from "react-native";

interface ItemContainerProps {
    children: React.ReactNode;
    style?: ViewStyle;
}

const ItemContainer: React.FC<ItemContainerProps> = ({children, style}) => {
    return <View style={[styles.itemContainer, style]}>{children}</View>
};


const styles = StyleSheet.create({
    itemContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: 10,
        marginTop: 20,
        alignItems: 'center',
        padding: 15,
        borderRadius: 10,
        backgroundColor: '#f9f9f9',  
        borderWidth: 1,  
        borderColor: '#e0e0e0',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 3, // Shadow effect for Android
    },
})

export default ItemContainer;
