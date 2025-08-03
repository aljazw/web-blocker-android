import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import Icon from './Icon';
import { shapes, spacing } from '../theme';
import { ThemedView } from './ThemedView';
import { useTheme } from '../context/ThemeContext';

interface SearchBarProps {
    placeholder?: string;
    onSearch: (query: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ placeholder = 'Search...', onSearch }) => {
    const [query, setQuery] = useState('');

    const handleClear = () => {
        setQuery('');
        onSearch('');
    };

    const { theme } = useTheme();

    return (
        <ThemedView withBorder style={styles.container}>
            <Icon name={'Search'} size={30} opacity="faded" style={styles.iconSearch} />
            <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder={placeholder}
                placeholderTextColor="#888888"
                onChangeText={text => {
                    setQuery(text);
                    onSearch(text);
                }}
                autoCapitalize="none"
                clearButtonMode="never"
                value={query}
                keyboardType="url"
            />
            <Pressable onPress={handleClear}>
                <Icon name={'Close'} size={17} opacity="faded" style={styles.iconClose} />
            </Pressable>
        </ThemedView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.xs,
        borderRadius: shapes.borderRadius.large,
        marginHorizontal: spacing.xs,
        borderWidth: shapes.borderWidth.thin,
    },
    input: {
        flex: 1,
        textAlignVertical: 'center',
        fontSize: 18,
    },
    iconSearch: {
        marginHorizontal: spacing.xs,
    },
    iconClose: {
        marginHorizontal: spacing.sm,
    },
});

export default SearchBar;
