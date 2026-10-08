import { StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { ThemedText } from './ThemedText';
import { APNEA_SAFETY } from '../constants/apnea';

/** Bulleted breath-hold safety rules, for dialogs. */
const SafetyRules: React.FC = () => {
    const { colors } = useTheme().theme;
    return (
        <View>
            {APNEA_SAFETY.rules.map(rule => (
                <View key={rule} style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: colors.muted }]} />
                    <ThemedText size="small" color="muted" style={styles.text}>
                        {rule}
                    </ThemedText>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: spacing.sm - 2,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginTop: 8,
        marginRight: spacing.sm,
    },
    text: {
        flex: 1,
    },
});

export default SafetyRules;
