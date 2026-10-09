import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { shapes, spacing } from '../theme';
import { haptics } from '../utils/haptics';
import Card from './Card';
import Icon, { IconName } from './Icon';

interface IconPickerProps {
    icons: IconName[];
    value: IconName;
    onChange: (icon: IconName) => void;
}

/** Grid of icons, eight per row, with the chosen one highlighted. */
const IconPicker: React.FC<IconPickerProps> = ({ icons, value, onChange }) => {
    const { colors } = useTheme().theme;
    return (
        <Card style={styles.grid}>
            {icons.map(name => {
                const selected = name === value;
                return (
                    <Pressable
                        key={name}
                        onPress={() => {
                            haptics.tap();
                            onChange(name);
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={name}
                        style={[
                            styles.cell,
                            selected && { backgroundColor: colors.accentSoft, borderColor: colors.accent },
                        ]}>
                        <Icon name={name} size={20} tint={selected ? colors.accent : colors.muted} />
                    </Pressable>
                );
            })}
        </Card>
    );
};

const styles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: 0,
        padding: spacing.sm,
    },
    cell: {
        width: '12.5%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: shapes.borderRadius.medium,
        borderWidth: 1,
        borderColor: 'transparent',
    },
});

export default memo(IconPicker);
