import { BlurView } from "@react-native-community/blur";
import { ReactNode } from "react";
import { Modal, StyleSheet, View } from "react-native";

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
                <View style={styles.popoutContainer}>
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
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        width: 300,
        alignItems: 'center',
    },

});


export default BlurModal;