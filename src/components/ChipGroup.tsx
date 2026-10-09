import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { gutter, spacing } from '../theme';

/** A wrapping row of Chips with the page gutter. */
const ChipGroup: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => (
    <View style={[styles.row, style]}>{children}</View>
);

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: gutter,
        marginTop: spacing.xs + 2,
    },
});

export default ChipGroup;
