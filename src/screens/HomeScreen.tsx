import { StyleSheet, Text, View } from "react-native";
import BaseScreen from "../components/BaseScreen"
import React from "react";


const HomeScreen: React.FC = () => {
    return (
        <BaseScreen title="Home Screen">
            <View></View>
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

export default HomeScreen;