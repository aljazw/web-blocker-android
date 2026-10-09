import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { RootStackNavigation } from '../types/types';
import { useTheme } from '../context/ThemeContext';
import { useApneaSession } from '../hooks/useApneaSession';
import { spacing } from '../theme';
import { PHASE_LABEL } from '../utils/apnea';
import { ThemedText } from './ThemedText';
import Card from './Card';
import Icon from './Icon';
import IconTile from './IconTile';

/**
 * "Session in progress" card, shown while a session runs in the background.
 * Polls on its own, so only this card re-renders each second, not the screen.
 */
const ApneaSessionBanner: React.FC = () => {
    const { colors } = useTheme().theme;
    const navigation = useNavigation<RootStackNavigation>();
    const { state: session } = useApneaSession(1000);
    const live = session?.status === 'running' || session?.status === 'paused';
    const phase = live ? session.phases[session.index] : undefined;
    if (!session || !phase) {
        return null;
    }

    return (
        <Card onPress={() => navigation.navigate('ApneaSession')} highlight={colors.accent}>
            <View style={styles.row}>
                <IconTile icon={session.status === 'paused' ? 'Pause' : 'Play'} tone="accent" />
                <View style={styles.text}>
                    <ThemedText weight="strong">{session.title} in progress</ThemedText>
                    <ThemedText size="small" color="muted">
                        {session.status === 'paused' ? 'Paused' : PHASE_LABEL[phase.type]} · round {phase.round}
                    </ThemedText>
                </View>
                <Icon name="Next" size={18} tint={colors.muted} />
            </View>
        </Card>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    text: {
        flex: 1,
        marginHorizontal: spacing.sm + 2,
    },
});

export default ApneaSessionBanner;
