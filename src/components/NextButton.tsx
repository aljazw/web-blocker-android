import { Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "./Icon";

interface NextButtonProps {
    onPress: () => void;
    buttonContainer?: object;
    buttonStyle?: object;
    textStyle?: object;
    iconStyle?: object;
}

const NextButton: React.FC<NextButtonProps> = ({
    onPress,
    buttonContainer = {},
    buttonStyle = {},
    textStyle = {},
    iconStyle = {},
}) => (
    <View style={[styles.nextButtonContainer, buttonContainer]}>
        <Pressable style={[styles.nextButton, buttonStyle]} onPress={onPress}>
                <Text style={[styles.nextButtonText, textStyle]}>Next</Text>
                <Icon name="Next" size={21} tint={false} style={[{ marginLeft: 5 }, iconStyle]}/>
        </Pressable>
    </View>
)

const styles = StyleSheet.create({
    nextButtonContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        marginTop: 18,
    },
    nextButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#34C759', 
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 50, 
        elevation: 3, // Stronger shadow for pop-out effect
        shadowColor: '#34C759',
        shadowOpacity: 0.4,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 8,
    },
    nextButtonText: {
        color: '#FAFAFA',
        fontSize: 18,
        fontWeight: '600',
        letterSpacing: 0.8, 
        textTransform: 'uppercase', 
    },
});

export default NextButton;