import { StyleSheet, View } from "react-native";
import BaseScreen from "../components/BaseScreen";
import { Switch } from "react-native-gesture-handler";
import { useState } from "react";
import { spacing, useTheme } from "../theme";
import { ThemedText } from "../components/ThemedText";


const SettingsScreen: React.FC = () => {

    const { isDarkMode, toggleTheme} = useTheme()
    const [isPassphraseProtectionEnabled, setIsPassphraseProtectionEnabled] = useState(false);

    const {theme} = useTheme();

    return (
        <BaseScreen title="Settings Screen">
            <View style={[styles.settingItem, {borderColor: theme.colors.border}]}>
                <ThemedText>Dark Mode</ThemedText>
                <Switch
                    value={isDarkMode}
                    onValueChange={toggleTheme}
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    thumbColor={isDarkMode ? '#3b82f6' : '#c0c0c0'}
                />
            </View>
            <View style={[styles.settingItem, {borderColor: theme.colors.border}]}>
                <ThemedText>Passphrase Protection</ThemedText>
                <Switch 
                    value={isPassphraseProtectionEnabled}
                    onValueChange={setIsPassphraseProtectionEnabled}
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    thumbColor={isPassphraseProtectionEnabled ? '#3b82f6' : '#c0c0c0'}
                />
            </View>
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
    },
});


export default SettingsScreen;