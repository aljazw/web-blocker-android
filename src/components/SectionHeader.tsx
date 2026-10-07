import { StyleSheet, View } from 'react-native';
import { spacing } from '../theme';
import { ThemedText } from './ThemedText';

interface SectionHeaderProps {
    title: string;
    right?: React.ReactNode;
}

/** Small uppercase label that introduces a group of cards. */
const SectionHeader: React.FC<SectionHeaderProps> = ({ title, right }) => (
    <View style={styles.row}>
        <ThemedText size="tiny" weight="strong" color="muted" style={styles.title}>
            {title.toUpperCase()}
        </ThemedText>
        {right}
    </View>
);

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: spacing.md + 4,
        marginTop: spacing.lg,
        marginBottom: spacing.xs,
    },
    title: {
        letterSpacing: 1.2,
    },
});

export default SectionHeader;
