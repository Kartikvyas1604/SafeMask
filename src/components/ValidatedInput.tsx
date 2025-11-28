import { TextInput, StyleSheet } from 'react-native';
import React from 'react';

interface ValidatedInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  validate?: (value: string) => boolean;
  errorMessage?: string;
  maxLength?: number;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export const ValidatedInput: React.FC<ValidatedInputProps> = ({
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  validate,
  maxLength,
  secureTextEntry,
  autoCapitalize = 'none',
}) => {
  const [isValid, setIsValid] = React.useState(true);

  const handleChange = (text: string) => {
    if (validate) {
      setIsValid(validate(text));
    }
    onChangeText(text);
  };

  return (
    <TextInput
      value={value}
      onChangeText={handleChange}
      placeholder={placeholder}
      keyboardType={keyboardType}
      maxLength={maxLength}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      style={[styles.input, !isValid && styles.inputError]}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
});
