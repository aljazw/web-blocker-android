import { StyleSheet, View } from 'react-native';
import ModalPanel from './ModalPanel';
import Button, { ButtonVariant } from './Button';
import IconTile from './IconTile';
import { IconName } from './Icon';
import { ThemedText } from './ThemedText';
import { spacing } from '../theme';

export interface DialogAction {
    label: string;
    onPress: () => void | Promise<unknown>;
    variant?: ButtonVariant;
}

interface DialogProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    message?: React.ReactNode;
    icon?: IconName;
    tone?: 'accent' | 'danger' | 'success';
    /** Buttons, left to right. Defaults to a single "OK" that closes. */
    actions?: DialogAction[];
    dismissable?: boolean;
    children?: React.ReactNode;
}

/** Standard dialog: optional icon, title, message, extra content, and a button row. */
const Dialog: React.FC<DialogProps> = ({
    visible,
    onClose,
    title,
    message,
    icon,
    tone = 'accent',
    actions,
    dismissable,
    children,
}) => {
    const buttons = actions ?? [{ label: 'OK', onPress: onClose, variant: 'secondary' as const }];

    return (
        <ModalPanel visible={visible} onClose={onClose} dismissable={dismissable}>
            {icon && <IconTile icon={icon} tone={tone} size={40} style={styles.icon} />}
            <ThemedText size="large" weight="bold">
                {title}
            </ThemedText>
            {message ? (
                typeof message === 'string' ? (
                    <ThemedText color="muted" style={styles.message}>
                        {message}
                    </ThemedText>
                ) : (
                    <View style={styles.message}>{message}</View>
                )
            ) : null}
            {children}
            <View style={styles.actions}>
                {buttons.map((action, index) => (
                    <Button
                        key={action.label}
                        label={action.label}
                        onPress={action.onPress}
                        variant={action.variant ?? (index === buttons.length - 1 ? 'primary' : 'secondary')}
                        compact
                        style={[styles.action, index > 0 && styles.actionGap]}
                    />
                ))}
            </View>
        </ModalPanel>
    );
};

/** Cancel + confirm pair for the common "are you sure?" case. */
export const confirmActions = (
    onCancel: () => void,
    confirmLabel: string,
    onConfirm: () => void | Promise<unknown>,
    destructive = false,
): DialogAction[] => [
    { label: 'Cancel', onPress: onCancel, variant: 'secondary' },
    { label: confirmLabel, onPress: onConfirm, variant: destructive ? 'danger' : 'primary' },
];

const styles = StyleSheet.create({
    icon: {
        marginBottom: spacing.md,
    },
    message: {
        marginTop: spacing.sm,
    },
    actions: {
        flexDirection: 'row',
        marginTop: spacing.lg,
    },
    action: {
        flex: 1,
    },
    actionGap: {
        marginLeft: spacing.sm,
    },
});

export default Dialog;
