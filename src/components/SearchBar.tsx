import React, { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Icon from "./Icon";


interface SearchBarProps {
    placeholder?: string;
    onSearch: (query: string) => void;
}


const SearchBar: React.FC<SearchBarProps> = ({ placeholder = "Search...", onSearch}) => {

    const [query, setQuery] = useState('');

    const handleClear = () => {
        setQuery("");
        onSearch("");
    };

    return (
        <View style={styles.container}>
            <Icon name={"Search"} size={30} style={styles.iconSearch}/>
            <TextInput
                style={styles.input}
                placeholder={placeholder}
                onChangeText={(text) => {
                    setQuery(text);
                    onSearch(text);
                }}
                autoCapitalize="none"
                clearButtonMode="never"
                value={query}
                keyboardType="url"
            />
            <Pressable onPress={handleClear}>
                <Icon name={"Close"} size={18} style={styles.iconClose}/>
            </Pressable>
            
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#A0A0A0',
        padding: 4,
        borderRadius: 20,
        marginHorizontal: 4,
    },
    input: {
        flex: 1,
        fontSize: 18,
        textAlignVertical: 'center',
        color: 'white',
    },
    iconSearch: {
        marginHorizontal: 5,
        opacity: 0.5,
    },
    iconClose: {
        marginHorizontal: 12,
        opacity: 0.4
    }
});

export default SearchBar;