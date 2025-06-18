import { BlurView } from "@react-native-community/blur";
import { ReactNode } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { shapes, spacing, useTheme } from "../theme";

interface BlurModalProps {
    children: ReactNode;
    visible: boolean;
    onClose: () => void;
}
const BlurModal: React.FC<BlurModalProps> = ({ children, visible, onClose }) => {

    const { theme } = useTheme();

    return (
        <Modal
            animationType="fade"
            transparent
            visible={visible}
            onRequestClose={onClose}
        >
            <BlurView
                blurType="light"
                blurAmount={10}
                style={styles.blurContainer}
            >
                <View style={[styles.popoutContainer, {backgroundColor: theme.colors.background, borderColor: theme.colors.border}]}>
                    {children}
                </View>
                
            </BlurView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    blurContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    popoutContainer: {
        padding: spacing.md,
        borderRadius: shapes.borderRadius.medium,
        borderWidth: shapes.borderWidth.thin,
        elevation: shapes.elevation.medium,
        width: 300,
        alignItems: 'center',
    },

});


export default BlurModal;