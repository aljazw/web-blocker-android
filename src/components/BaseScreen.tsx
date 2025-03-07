import React from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";


interface BaseScreenProps {
    children: React.ReactNode;
    title?: string;
    backgroundColor?: string;
    padding?: number;
    isLoading?: boolean;
    customStyles?: object;
    showHeader?: boolean;
}

const BaseScreen: React.FC<BaseScreenProps> = ({
    children,
    title,
    backgroundColor = '#f8f8f8',
    padding =  16,
    isLoading = false,
    customStyles = {},
    showHeader = true
}) => {
    return (
        <SafeAreaView style={[styles.container, {backgroundColor}]}>
            {showHeader && (
                <View style={styles.header}>
                    {title && <Text style={styles.title}>{title}</Text>}
                </View>
            )}

            <View style={[styles.content, {padding}, customStyles]}>
                {isLoading ? (
                    <ActivityIndicator size="large" color="#0000ff" />
                ) : (
                    children
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 16,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderBottomColor: '#ddd',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold', 
    },
    content: {
        flex: 1,
    },
})

export default BaseScreen;