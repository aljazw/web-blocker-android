import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const GuideContainer = () => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Guide</Text>
            <Text style={styles.step}>
                1. Enter the domain name or URL without "https://" or "www". Instead of adding <Text style={styles.highlight}>https://www.facebook.com</Text>, just type <Text style={styles.highlight}>facebook.com</Text>.
            </Text>
            <Text style={styles.step}>
                2. If you need a specific webpage or directory, type it directly. For example, enter <Text style={styles.highlight}>facebook.com/home</Text> to access a particular section.
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#f8f9fa', 
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ddd',
        margin: 16,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 3,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
    },
    step: {
        fontSize: 14,
        color: '#555',
        marginBottom: 8,
    },
    highlight: {
        fontWeight: 'bold',
        color: '#007bff',
    }
});

export default GuideContainer;
