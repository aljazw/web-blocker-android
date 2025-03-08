import { StyleSheet, Text, View, ScrollView } from "react-native";
import BaseScreen from "../components/BaseScreen";
import { useState, useEffect } from "react";
import SearchBar from "../components/SearchBar";
import { fetchSearchResults } from "../services/duckduckgoApi";

let lastSearchTime = 0;

const AddSiteScreen: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [websites, setWebsites] = useState<string[]>([]);  // State to hold search results

    const fetchWebsites = async (query: string) => {

        const now = Date.now();
        if (now - lastSearchTime < 1000) return; // 5 seconds cooldown
        lastSearchTime = now;

        if (query.length < 3) {
            setWebsites([]);
            return;
        }
        const searchResults = await fetchSearchResults(query);
        // console.log(searchResults)
        // setResults(searchResults);

        // try {
        //     const data = await fetchSearchResults(query);
        //     console.log(data);
        //     if (data && data.organic_results) {
        //         const links = data.organic_results.map((result: any) => result.link);
        //         setWebsites(links);
        //     }
        // } catch (error) {
        //     console.error("Error fetching websites: ", error);
        // }
    };

    
    useEffect(() => {
        fetchWebsites(searchQuery);
    }, [searchQuery]);

    return (
        <BaseScreen title="Add Site">
            <SearchBar placeholder="Search websites..." onSearch={setSearchQuery} />
            <ScrollView style={styles.resultsContainer}>
                {websites.length === 0 ? (
                    <Text>No results found for "{searchQuery}"</Text>
                ) : (
                    websites.map((website, index) => (
                        <View key={index} style={styles.websiteItem}>
                            <Text>{website}</Text>
                        </View>
                    ))
                )}
            </ScrollView>
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
    },
    resultsContainer: {
        marginTop: 20,
        paddingHorizontal: 10,
    },
    websiteItem: {
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
});

export default AddSiteScreen;
