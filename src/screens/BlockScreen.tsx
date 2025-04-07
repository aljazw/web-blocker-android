import BaseScreen from "../components/BaseScreen";
import { Text, View } from "react-native";
import Icon from "../components/Icon";
import NextButton from "../components/NextButton";
import { useNavigation } from "@react-navigation/native";
import { RootStackNavigation } from "../types/types";

const BlockScreen: React.FC = () => {

    const navigation = useNavigation<RootStackNavigation>();

    const handlePressNext = () => {
        navigation.navigate('AddSite');
    }

    return(
        <BaseScreen title="Block Screen">
            <View>
                <NextButton onPress={handlePressNext}/>
            </View>
        </BaseScreen>
    );
}

export default BlockScreen