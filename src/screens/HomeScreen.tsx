import { StyleSheet, Text, View } from "react-native";
import BaseScreen from "../components/BaseScreen"
import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlockedWebsitesData } from "../types/types";
import ItemContainer from "../components/itemContainer";



const HomeScreen: React.FC = () => {

    const [websites, setWebsite] = useState<BlockedWebsitesData[]>([]);

    const getWebsitesData = async () => {
        try {
            const existingData = await AsyncStorage.getItem('@blocked_websites');
            const websitesData = existingData ? JSON.parse(existingData) : [];
            setWebsite(websitesData);
        } catch (error) {
            console.log('Error fetching existing website data', error)
        }
    };

    useEffect(()=> {
        getWebsitesData();
    }, []);


    return (
        <BaseScreen title="Home Screen">
            <View>
                {websites.length === 0 ? (
                    <Text>No Blocked Webistes</Text>
                ) :  (
                    <View>
                        {websites.map((website, index) => (
                            <ItemContainer >
                                <Text key={index}>{website.website.url}</Text>
                            </ItemContainer>
                            
                        ))}
                    </View>
                   
                )}
            </View>
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

export default HomeScreen;