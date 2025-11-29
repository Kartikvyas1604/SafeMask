import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  StatusBar,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../design/colors';
import { Typography } from '../design/typography';

interface CalculatorModeScreenProps {
  navigation: {
    replace: (screen: string) => void;
  };
}

const UNLOCK_SEQUENCE = '1337';

export default function CalculatorModeScreen({ navigation }: CalculatorModeScreenProps) {
  const insets = useSafeAreaInsets();
  const [display, setDisplay] = useState('0');
  const [input, setInput] = useState('');
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [secretSequence, setSecretSequence] = useState('');

  const handleNumberPress = (num: string) => {
    const newSequence = secretSequence + num;
    setSecretSequence(newSequence);

    if (newSequence === UNLOCK_SEQUENCE) {
      Vibration.vibrate([50, 100, 50]);
      setTimeout(() => navigation.replace('LockScreen'), 200);
      return;
    }

    if (newSequence.length > UNLOCK_SEQUENCE.length) {
      setSecretSequence(newSequence.slice(-UNLOCK_SEQUENCE.length));
    }

    if (display === '0' && num !== '.') {
      setDisplay(num);
      setInput(num);
    } else if (display.length < 12) {
      const newDisplay = display + num;
      setDisplay(newDisplay);
      setInput(newDisplay);
    }
  };

  const handleOperationPress = (op: string) => {
    setSecretSequence('');
    if (input && !operation) {
      setPreviousValue(input);
      setOperation(op);
      setDisplay('0');
      setInput('');
    } else if (operation && input) {
      handleEquals();
      setOperation(op);
    }
  };

  const handleEquals = () => {
    setSecretSequence('');
    if (previousValue && operation && input) {
      const prev = parseFloat(previousValue);
      const curr = parseFloat(input);
      let result = 0;

      switch (operation) {
        case '+': result = prev + curr; break;
        case '-': result = prev - curr; break;
        case '×': result = prev * curr; break;
        case '÷': result = curr !== 0 ? prev / curr : 0; break;
      }

      const resultStr = result.toString().slice(0, 12);
      setDisplay(resultStr);
      setInput(resultStr);
      setPreviousValue(null);
      setOperation(null);
    }
  };

  const handleClear = () => {
    setSecretSequence('');
    setDisplay('0');
    setInput('');
    setPreviousValue(null);
    setOperation(null);
  };

  const renderButton = (label: string, onPress: () => void, style?: ViewStyle) => (
    <TouchableOpacity style={[styles.button, style]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.buttonText, (style as { color?: string })?.color && { color: (style as { color?: string }).color }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      <View style={styles.displayContainer}>
        <Text style={styles.displayText} numberOfLines={1} adjustsFontSizeToFit>
          {display}
        </Text>
        {operation && <Text style={styles.operationText}>{previousValue} {operation}</Text>}
      </View>

      <Text style={styles.hintText}>Standard Calculator</Text>

      <View style={styles.buttonsContainer}>
        <View style={styles.row}>
          {renderButton('C', handleClear, styles.functionButton)}
          {renderButton('⌫', () => {}, styles.functionButton)}
          {renderButton('%', () => {}, styles.functionButton)}
          {renderButton('÷', () => handleOperationPress('÷'), styles.operatorButton)}
        </View>

        <View style={styles.row}>
          {renderButton('7', () => handleNumberPress('7'))}
          {renderButton('8', () => handleNumberPress('8'))}
          {renderButton('9', () => handleNumberPress('9'))}
          {renderButton('×', () => handleOperationPress('×'), styles.operatorButton)}
        </View>

        <View style={styles.row}>
          {renderButton('4', () => handleNumberPress('4'))}
          {renderButton('5', () => handleNumberPress('5'))}
          {renderButton('6', () => handleNumberPress('6'))}
          {renderButton('-', () => handleOperationPress('-'), styles.operatorButton)}
        </View>

        <View style={styles.row}>
          {renderButton('1', () => handleNumberPress('1'))}
          {renderButton('3', () => handleNumberPress('3'))}
          {renderButton('3', () => handleNumberPress('3'))}
          {renderButton('+', () => handleOperationPress('+'), styles.operatorButton)}
        </View>

        <View style={styles.row}>
          {renderButton('0', () => handleNumberPress('0'), styles.zeroButton)}
          {renderButton('.', () => handleNumberPress('.'))}
          {renderButton('=', handleEquals, styles.equalsButton)}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  displayContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 24,
    backgroundColor: Colors.card,
  },
  displayText: {
    fontSize: 56,
    fontFamily: Typography.fontFamily.primary,
    color: Colors.textPrimary,
    fontWeight: '300',
  },
  operationText: {
    fontSize: 20,
    fontFamily: Typography.fontFamily.primary,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  hintText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.primary,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
    opacity: 0.5,
  },
  buttonsContainer: { padding: 16 },
  row: { flexDirection: 'row', marginBottom: 12 },
  button: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: Colors.card,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    fontSize: 28,
    fontFamily: Typography.fontFamily.primary,
    color: Colors.textPrimary,
  },
  functionButton: { backgroundColor: Colors.cardHover, color: Colors.accent },
  operatorButton: { backgroundColor: Colors.accent, color: Colors.background },
  equalsButton: { backgroundColor: Colors.accentSecondary, color: Colors.background },
  zeroButton: { flex: 2 },
});
