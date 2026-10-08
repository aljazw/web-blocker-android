import { StyleSheet, View } from 'react-native';
import { gutter, spacing } from '../theme';

/** A row of StatTiles aligned to the page gutter. */
const StatRow: React.FC<{ children: React.ReactNode }> = ({ children }) => <View style={styles.row}>{children}</View>;

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        marginHorizontal: gutter - 4,
        marginTop: spacing.sm,
    },
});

export default StatRow;
