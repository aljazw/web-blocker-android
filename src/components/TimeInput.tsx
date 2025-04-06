import React, { useRef } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';



interface TimeInputProps {
    label: string;
    hourValue: string;
    minutesValue: string;
    setHour: React.Dispatch<React.SetStateAction<string>>;
    setMinutes: React.Dispatch<React.SetStateAction<string>>;
}

const TimeInput: React.FC<TimeInputProps> = ({
    label,
    hourValue,
    minutesValue,
    setHour,
    setMinutes,
}) => {

    const minutesRef = useRef<TextInput | null>(null);

    const handleHourChange = (
        text: string,
        setHour: React.Dispatch<React.SetStateAction<string>>
    ) => {
        const numericText = text.replace(/[^0-9]/g, '');
        if (numericText.length === 1) {
            const firstDigit = parseInt(numericText);
        
            if (firstDigit > 2) {
              const fixedText = '0' + firstDigit;
              setHour(fixedText);
              minutesRef.current?.focus();
            } else {
              setHour(numericText);
            }
          } else if (numericText.length === 2) {
            const hour = parseInt(numericText);
        
            if (hour > 23) {
              setHour((prev) => prev);  
            } else {
              setHour(numericText);
              minutesRef.current?.focus();
            }
          } else {
            setHour(numericText);
          }
    };

    const handleMinutesChange = (
        text: string,
        setMinutes: React.Dispatch<React.SetStateAction<string>>
    ) => {
        // Remove non-numeric characters
        const numericText = text.replace(/[^0-9]/g, '');
      
        if (numericText.length === 1) {
          const firstDigit = parseInt(numericText);
      
          if (firstDigit > 5) {
            setMinutes((prev) => prev);
          } else {
            setMinutes(numericText);
          }
        } else if (numericText.length === 2) {
          const hour = parseInt(numericText);
      
          if (hour > 59) {
            setMinutes((prev) => prev);  
          } else {
            setMinutes(numericText);
          }
        } else {
          setMinutes(numericText);
        }
      };


    return (
        <View>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.inputContainer}>
                <TextInput
                style={styles.input}
                value={hourValue}
                onChangeText={(text) => handleHourChange(text, setHour)}
                placeholder="00"
                placeholderTextColor="lightgray"
                keyboardType="numeric"
                maxLength={2}
                />
                <Text style={styles.colonText}>:</Text>
                <TextInput
                ref={minutesRef}
                style={styles.input}
                value={minutesValue}
                onChangeText={(text) => handleMinutesChange(text, setMinutes)}
                placeholder="00"
                placeholderTextColor="lightgray"
                keyboardType="numeric"
                maxLength={2}
                />
            </View>
        </View>
    
    );
};

const styles = StyleSheet.create({
container: {
    padding: 20,
},
label: {
    marginTop: 10,
    fontSize: 16,
},
inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'gray',
    padding: 10,
    borderRadius: 5,
    height: 60,
    marginTop: 20,
    width: 150
},
input: {
    marginHorizontal: 10,
    fontSize: 20,
    textAlign: 'center',
    width: 40,
    height: 57,
    color: 'black',
},
colonText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'black',
}
});


export default TimeInput;