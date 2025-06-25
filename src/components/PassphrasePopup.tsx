import { useEffect, useState } from "react";
import BlurModal from "./BlurModal";
import { ThemedText } from "./ThemedText";
import { StyleSheet, Text, View } from "react-native";
import ActionButton from "./ActionButton";
import { shapes, spacing, useTheme } from "../theme";
import { TextInput } from "react-native-gesture-handler";
import { ThemedView } from "./ThemedView";
import { sampleTexts, unblockMessages } from "../assets/data/textContent";

interface PassphrasePopupProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
};

const PassphrasePopup: React.FC<PassphrasePopupProps> = ({
    visible,
    onClose,
    onConfirm
}) => {

    // const getRandomText = () => {
    //     const index = Math.floor(Math.random() * unblockMessages.length);
    //     return unblockMessages[index]
    // };

    const getRandomText = () => {
        const index = Math.floor(Math.random() * sampleTexts.length);
        return sampleTexts[index]
    };

    const [text, setText] = useState('');

    useEffect(() => {
        setText(getRandomText());
    }, []);

    const onPressConfirm = () => {
        if (isMatch) {
            setInputValue('');
            onConfirm();
        } else {
            setShowError(true);
        }
    }; 

    const [inputValue, setInputValue] = useState('');
    const { theme } =  useTheme();
    const [showError, setShowError] = useState(false);

    const isMatch = inputValue === text;

    return (
        <BlurModal visible={visible} onClose={onClose}>
            <ThemedText weight="strong" size="large">Confirm Passphrase Protection{'\n'}</ThemedText>
            <ThemedText>
                Enter the paragraph below  to continue with the action.
            </ThemedText>
            <View style={styles.textView}>
                <ThemedText opacity="faded">
                    <HighlightMismatchText originalText={text} userInput={inputValue}/>
                </ThemedText>
            </View>
            
            <ThemedView withBorder style={styles.inputView}>
                <TextInput 
                    style={{
                        color: theme.colors.text,
                        textAlignVertical: 'top',
                    }}
                    placeholder="Type the phrase here"
                    placeholderTextColor="#888888"
                    value={inputValue}
                    onChangeText={(text) => {
                        setInputValue(text);
                        setShowError(false);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline={true}
                    keyboardType="visible-password"
                />
            </ThemedView>

            {showError && (
                <ThemedText color="primaryRed">The texts aren't matching</ThemedText>
            )}

            <View style={styles.popupButtonsContainer}> 
                <ActionButton variant="cancel" onPress={onClose} />
                <ActionButton variant="confirm" onPress={onPressConfirm} />
            </View>
        </BlurModal>
    );             
};


type Props = {
  originalText: string;
  userInput: string;
};

const HighlightMismatchText: React.FC<Props> = ({ originalText, userInput }) => {
  const elements = [];

  for (let i = 0; i < originalText.length; i++) {
    const originalChar = originalText[i];
    const inputChar = userInput[i];

    const isMatch = originalChar === inputChar;

    elements.push(
      <ThemedText
        key={i}
        color={isMatch ? "text" : "primaryRed"}
      >
        {originalChar}
      </ThemedText>
    );
  }

  return <Text>{elements}</Text>;
};

const styles = StyleSheet.create({
    textView: {
        alignSelf: 'stretch',
        marginTop: spacing.sm,
    },
    inputView: {
        flex: 1,
        borderRadius: shapes.borderRadius.small,
        marginTop: spacing.lg,
        alignSelf: 'stretch',
        maxHeight: 200,
        paddingHorizontal: spacing.sm
    },
      popupButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.lg,
    },
});


export default PassphrasePopup;