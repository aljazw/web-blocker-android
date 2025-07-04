import { StyleSheet, View } from 'react-native';
import BaseScreen from '../components/BaseScreen';
import { Switch } from 'react-native-gesture-handler';
import { useState } from 'react';
import { spacing, useTheme } from '../theme';
import { ThemedText } from '../components/ThemedText';
import BlurModal from '../components/BlurModal';
import ActionButton from '../components/ActionButton';
import { usePassphrase } from '../context/PassphraseContext';
import PassphrasePopup from '../components/PassphrasePopup';
import { ThemedView } from '../components/ThemedView';

const SettingsScreen: React.FC = () => {
    const { isDarkMode, toggleTheme } = useTheme();
    const { isEnabled, setEnabled } = usePassphrase();

    const [showEnablePopup, setShowEnablePopup] = useState(false);
    const [showDisablePopup, setShowDisablePopup] = useState(false);
    const [pendingToggleValue, setPendingToggleValue] = useState<boolean | null>(null);

    const handleTogglePassphrase = (nextValue: boolean) => {
        setPendingToggleValue(nextValue);
        nextValue ? setShowEnablePopup(true) : setShowDisablePopup(true);
    };

    const confirmEnable = () => {
        setShowEnablePopup(false);
        setPendingToggleValue(null);
        setEnabled(true);
    };

    const cancelEnable = () => {
        setShowEnablePopup(false);
        setPendingToggleValue(null);
    };

    const confirmDisable = () => {
        setShowDisablePopup(false);
        setPendingToggleValue(null);
        setEnabled(false);
    };

    const cancelDisable = () => {
        setShowDisablePopup(false);
        setPendingToggleValue(null);
    };

    return (
        <BaseScreen title="Settings Screen">
            <ThemedView color="background" style={styles.settingItem}>
                <ThemedText>Dark Mode</ThemedText>
                <Switch
                    value={isDarkMode}
                    onValueChange={toggleTheme}
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    thumbColor={isDarkMode ? '#3b82f6' : '#c0c0c0'}
                />
            </ThemedView>
            <ThemedView withBorder style={styles.divideContainer} />
            <ThemedView color="background" style={styles.settingItem}>
                <ThemedText>Passphrase Protection</ThemedText>
                <Switch
                    value={pendingToggleValue ?? isEnabled}
                    onValueChange={handleTogglePassphrase}
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    thumbColor={pendingToggleValue ?? isEnabled ? '#3b82f6' : '#c0c0c0'}
                />
            </ThemedView>
            <ThemedView withBorder style={styles.divideContainer} />
            <PopUpPassphrase visible={showEnablePopup} onClose={cancelEnable} onConfirm={confirmEnable} />
            <PassphrasePopup visible={showDisablePopup} onClose={cancelDisable} onConfirm={confirmDisable} />
        </BaseScreen>
    );
};

interface PopUpPassphraseProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const PopUpPassphrase: React.FC<PopUpPassphraseProps> = ({ visible, onClose, onConfirm }) => {
    return (
        <BlurModal visible={visible} onClose={onClose}>
            <ThemedText weight="medium" align="center">
                Are you sure you want to enable passphrase protection?{'\n\n'}
                <ThemedText size="small">
                    This will require you to type a long phrase every time you attempt to remove a blocked website.
                    {'\n\n'}
                    It's designed to help you stay focused and stick to your goals.
                </ThemedText>
            </ThemedText>
            <View style={styles.popupButtonsContainer}>
                <ActionButton variant="cancel" onPress={onClose} />
                <ActionButton variant="confirm" onPress={onConfirm} />
            </View>
        </BlurModal>
    );
};

const styles = StyleSheet.create({
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
    },
    popupButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.lg,
    },
    divideContainer: {
        height: 1,
    },
});

export default SettingsScreen;
