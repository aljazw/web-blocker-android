import { BlurView } from "@react-native-community/blur";
import { ReactNode } from "react";
import { Modal, StyleSheet } from "react-native";
import { shapes, spacing } from "../theme";
import { ThemedView } from "./ThemedView";

interface BlurModalProps {
    children: ReactNode;
    visible: boolean;
    onClose: () => void;
}
const BlurModal: React.FC<BlurModalProps> = ({ children, visible, onClose }) => {

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
                <ThemedView color="background" withBorder style={styles.popoutContainer}>
                    {children}
                </ThemedView>
                
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
        alignItems: 'center',
        maxWidth: '80%'
    },

});


export default BlurModal;