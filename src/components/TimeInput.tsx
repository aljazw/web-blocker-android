import React, { useRef } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { ThemedText } from './ThemedText';
import { shapes, spacing, useTheme } from '../theme';



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

	const { theme } = useTheme();

	return (
		<View>
			<ThemedText style={styles.label}>{label}</ThemedText>
			<View style={styles.inputContainer}>
					<TextInput
						style={[styles.input, {color: theme.colors.text}]}
						value={hourValue}
						onChangeText={(text) => handleHourChange(text, setHour)}
						onBlur={() => {
							if (hourValue.length === 1) {
								setHour(`0${hourValue}`);
							}
						}}
						placeholder="00"
						placeholderTextColor="lightgray"
						keyboardType="numeric"
						maxLength={2}
					/>
					<ThemedText size="large" weight="strong">:</ThemedText>
					<TextInput
						ref={minutesRef}
						style={[styles.input, {color: theme.colors.text}]}
						value={minutesValue}
						onChangeText={(text) => handleMinutesChange(text, setMinutes)}
						onBlur={() => {
							if (minutesValue.length === 1) {
								setMinutes(`0${minutesValue}`)
							}
						}}
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
			padding: spacing.lg,
	},
	label: {
			marginTop: spacing.sm,
	},
	inputContainer: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			borderWidth: shapes.borderWidth.thin,
			borderColor: 'gray',
			padding: spacing.sm,
			borderRadius: shapes.borderRadius.small,
			height: 60,
			marginTop: spacing.lg,
			width: 150
	},
	input: {
			marginHorizontal: spacing.sm,
			fontSize: 20,
			textAlign: 'center',
			width: 40,
			height: 57,
			color: 'black',
	},
});


export default TimeInput;