import { StyleSheet, Text, View } from "react-native";
import BaseScreen from "../components/BaseScreen"
import React, { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlockedWebsitesData } from "../types/types";
import ItemContainer from "../components/itemContainer";
import Favicon from "../components/Favicon";



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
                            <ItemContainer key={index}>
                                <View style={styles.innerLeftContainer}>
                                    <Favicon url={website.websiteUrl}/>
                                    <Text>{website.websiteUrl}</Text>
                                </View>
                            </ItemContainer>
                        ))}
                    </View>
                )}
            </View>
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    innerLeftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default HomeScreen;