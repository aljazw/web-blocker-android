import { StyleSheet } from 'react-native';
import { spacing } from '../theme';
import Card from './Card';
import { IconName } from './Icon';
import IconTile from './IconTile';
import { FadeIn } from './Motion';
import { ThemedText } from './ThemedText';

interface EmptyStateProps {
    icon: IconName;
    title: string;
    text: string;
    /** Buttons below the text. */
    children?: React.ReactNode;
}

/** The card a list shows before it has anything in it: what it's for and how to start. */
const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, text, children }) => (
    <FadeIn delay={40}>
        <Card style={styles.card}>
            <IconTile icon={icon} tone="accent" size={44} />
            <ThemedText size="large" weight="bold" style={styles.title}>
                {title}
            </ThemedText>
            <ThemedText color="muted" style={[styles.text, !children && styles.last]}>
                {text}
            </ThemedText>
            {children}
        </Card>
    </FadeIn>
);

const styles = StyleSheet.create({
    card: {
        marginTop: spacing.md,
        padding: spacing.lg,
    },
    title: {
        marginTop: spacing.md,
    },
    text: {
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
    },
    last: {
        marginBottom: 0,
    },
});

export default EmptyState;
