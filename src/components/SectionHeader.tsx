import { StyleSheet, View } from 'react-native';
import { gutter, spacing } from '../theme';
import { ThemedText } from './ThemedText';

interface SectionHeaderProps {
    title: string;
    right?: React.ReactNode;
}

/** Small uppercase label that introduces a group of cards. */
const SectionHeader: React.FC<SectionHeaderProps> = ({ title, right }) => (
    <View style={styles.row}>
        <ThemedText size="tiny" weight="strong" color="muted" caps>
            {title}
        </ThemedText>
        {right}
    </View>
);

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: gutter + 2,
        marginTop: spacing.xl,
        marginBottom: spacing.xs,
        minHeight: 18,
    },
});

export default SectionHeader;
