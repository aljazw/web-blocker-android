import { AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import BaseScreen from '../components/BaseScreen';
import { Switch } from 'react-native-gesture-handler';
import { useEffect, useRef, useState } from 'react';
import { spacing, useTheme } from '../theme';
import { ThemedText } from '../components/ThemedText';
import BlurModal from '../components/BlurModal';
import ActionButton from '../components/ActionButton';
import { usePassphrase } from '../context/PassphraseContext';
import PassphrasePopup from '../components/PassphrasePopup';
import { ThemedView } from '../components/ThemedView';
import { checkAdmin, toggleDeviceAdmin } from '../utils/deviceAdmin';
import { ERRORS, PASSPHRASE_PROTECTION, UNINSTALL_PREVENTION } from '../constants/strings';
import ErrorPopup from '../components/ErrorPopup';

const SettingsScreen: React.FC = () => {
    const { isDarkMode, toggleTheme } = useTheme();
    const { isPassphraseEnabled, setPassphraseEnabled } = usePassphrase();
    const [isAdminEnabled, setIsAdminEnabled] = useState(false);

    const [showEnablePassphrasePopup, setShowEnablePassphrasePopup] = useState(false);
    const [showDisablePassphrasePopup, setShowDisablePassphrasePopup] = useState(false);
    const [pendingToggleValue, setPendingToggleValue] = useState<boolean | null>(null);

    const [showEnableUninstallPreventionPopup, setShowEnableUninstallPreventionPopup] = useState(false);
    const [showDisableUninstallPreventionPopup, setShowDisableUninstallPreventionPopup] = useState(false);
    const [showPassphraseUninstallPreventionPopup, setShowPassphraseUninstallPreventionPopup] = useState(false);

    const [errorPopupVisible, setErrorPopupVisible] = useState(false);

    const appState = useRef(AppState.currentState);

    const handleTogglePassphrase = (nextValue: boolean) => {
        setPendingToggleValue(nextValue);
        nextValue ? setShowEnablePassphrasePopup(true) : setShowDisablePassphrasePopup(true);
    };

    const handleToggleUninstallPrevention = (nextValue: boolean) => {
        nextValue ? setShowEnableUninstallPreventionPopup(true) : setShowDisableUninstallPreventionPopup(true);
    };

    const confirmEnablePassphrase = () => {
        setShowEnablePassphrasePopup(false);
        setPendingToggleValue(null);
        setPassphraseEnabled(true);
    };

    const cancelEnablePassphrase = () => {
        setShowEnablePassphrasePopup(false);
        setPendingToggleValue(null);
    };

    const confirmDisablePassphrase = () => {
        setShowDisablePassphrasePopup(false);
        setPendingToggleValue(null);
        setPassphraseEnabled(false);
    };

    const cancelDisablePassphrase = () => {
        setShowDisablePassphrasePopup(false);
        setPendingToggleValue(null);
    };

    const confirmUninstallPreventionChange = async () => {
        try {
            const result = await toggleDeviceAdmin();
            if (result === false) {
                setIsAdminEnabled(false);
            }
        } catch (err) {
            setErrorPopupVisible(true);
        }
    };

    const confirmEnableUninstallPrevention = async () => {
        setShowEnableUninstallPreventionPopup(false);
        await confirmUninstallPreventionChange();
    };

    const confirmDisableUninstallPrevention = async () => {
        if (isPassphraseEnabled) {
            setShowPassphraseUninstallPreventionPopup(true);
            setShowDisableUninstallPreventionPopup(false);
        } else {
            setShowDisableUninstallPreventionPopup(false);
            await confirmUninstallPreventionChange();
        }
    };

    const confirmPassphraseUninstallPrevention = async () => {
        await confirmUninstallPreventionChange();
        setShowPassphraseUninstallPreventionPopup(false);
    };

    useEffect(() => {
        const checkStatus = async () => {
            const enabled = await checkAdmin();
            setIsAdminEnabled(enabled);
        };

        checkStatus();

        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                // App has come to the foreground — check Device Admin status again
                checkStatus();
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, []);

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
                    value={pendingToggleValue ?? isPassphraseEnabled}
                    onValueChange={handleTogglePassphrase}
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    thumbColor={pendingToggleValue ?? isPassphraseEnabled ? '#3b82f6' : '#c0c0c0'}
                />
            </ThemedView>
            <ThemedView withBorder style={styles.divideContainer} />
            <ThemedView color="background" style={styles.settingItem}>
                <ThemedText>Uninstall Prevention</ThemedText>
                <Switch
                    value={isAdminEnabled}
                    onValueChange={handleToggleUninstallPrevention}
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    thumbColor={isAdminEnabled ? '#3b82f6' : '#c0c0c0'}
                />
            </ThemedView>
            <ThemedView withBorder style={styles.divideContainer} />

            <PopUp
                visible={showEnablePassphrasePopup}
                title={PASSPHRASE_PROTECTION.title}
                text={PASSPHRASE_PROTECTION.text}
                onClose={cancelEnablePassphrase}
                onConfirm={confirmEnablePassphrase}
            />
            <PassphrasePopup
                visible={showDisablePassphrasePopup}
                onClose={cancelDisablePassphrase}
                onConfirm={confirmDisablePassphrase}
            />

            <PopUp
                visible={showEnableUninstallPreventionPopup}
                title={UNINSTALL_PREVENTION.enable.title}
                text={UNINSTALL_PREVENTION.enable.text}
                onClose={() => setShowEnableUninstallPreventionPopup(false)}
                onConfirm={confirmEnableUninstallPrevention}
            />
            <PopUp
                visible={showDisableUninstallPreventionPopup}
                title={UNINSTALL_PREVENTION.disable.title}
                text={UNINSTALL_PREVENTION.disable.text}
                onClose={() => setShowDisableUninstallPreventionPopup(false)}
                onConfirm={confirmDisableUninstallPrevention}
            />
            <PassphrasePopup
                visible={showPassphraseUninstallPreventionPopup}
                onClose={() => setShowPassphraseUninstallPreventionPopup(false)}
                onConfirm={confirmPassphraseUninstallPrevention}
            />

            <ErrorPopup
                title={ERRORS.uninstallPrevention.title}
                text={ERRORS.uninstallPrevention.text}
                visible={errorPopupVisible}
                onClose={() => setErrorPopupVisible(false)}
            />
        </BaseScreen>
    );
};

interface PopUpProps {
    visible: boolean;
    title: string;
    text: string;
    onClose: () => void;
    onConfirm: () => void;
}

const PopUp: React.FC<PopUpProps> = ({ visible, onClose, onConfirm, title, text }) => {
    return (
        <BlurModal visible={visible} onClose={onClose}>
            <ThemedText weight="medium" align="center">
                {title}
                <ThemedText size="small">{text}</ThemedText>
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
