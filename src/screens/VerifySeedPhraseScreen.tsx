import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ZetarisWalletCore } from '../core/ZetarisWalletCore';

interface VerifySeedPhraseScreenProps {
  route: {
    params: {
      seedPhrase: string;
    };
  };
  navigation: {
    navigate: (screen: string) => void;
    goBack: () => void;
    reset: (config: { index: number; routes: Array<{ name: string }> }) => void;
  };
}

export default function VerifySeedPhraseScreen({ route, navigation }: VerifySeedPhraseScreenProps) {
  const insets = useSafeAreaInsets();
  const { seedPhrase } = route.params;
  const words = seedPhrase.split(' ');
  
  // Select 3 random indices
  const [indices] = useState(() => {
    const selected: number[] = [];
    while (selected.length < 3) {
      const rand = Math.floor(Math.random() * 24);
      if (!selected.includes(rand)) {
        selected.push(rand);
      }
    }
    return selected.sort((a, b) => a - b);
  });

  const [inputs, setInputs] = useState<string[]>(['', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'verify' | 'password'>('verify');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInputChange = (text: string, index: number) => {
    const newInputs = [...inputs];
    newInputs[index] = text;
    setInputs(newInputs);
    setError('');
  };

  const handleVerify = async () => {
    // Check if all words match
    const correct = indices.every((wordIndex, i) => 
      inputs[i].toLowerCase().trim() === words[wordIndex]
    );

    if (!correct) {
      setError('Incorrect words. Please try again.');
      setInputs(['', '', '']);
      return;
    }

    // Move to password setup
    setStep('password');
  };

  const handlePasswordSetup = async () => {
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter a password');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    // Save wallet
    setLoading(true);
    try {
      const walletCore = new ZetarisWalletCore();
      const wallet = await walletCore.importWallet(seedPhrase);
      
      // Save to AsyncStorage
      await AsyncStorage.setItem('Zetaris_wallet_data', JSON.stringify(wallet));
      await AsyncStorage.setItem('Zetaris_has_wallet', 'true');
      await AsyncStorage.setItem('Zetaris_password', password);
      await AsyncStorage.setItem('Zetaris_last_unlock', Date.now().toString());
      
      // Navigate to main wallet
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
      
      Alert.alert('Success', 'Your wallet has been created!');
    } catch (err) {
      Alert.alert('Error', 'Failed to save wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {step === 'verify' ? (
          <>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Verify Recovery Phrase</Text>
              <Text style={styles.subtitle}>
                Enter the following words to confirm you've saved them
              </Text>
            </View>

            {/* Input Fields */}
            <View style={styles.inputContainer}>
              {indices.map((wordIndex, i) => (
                <View key={i} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Word #{wordIndex + 1}</Text>
                  <TextInput
                    style={styles.input}
                    value={inputs[i]}
                    onChangeText={(text) => handleInputChange(text, i)}
                    placeholder="Enter word"
                    placeholderTextColor="#6B7280"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ))}
            </View>

            {/* Error Message */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Verify Button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Verify & Continue</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Password Setup Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setStep('verify')} style={styles.backButton}>
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Set Wallet Password</Text>
              <Text style={styles.subtitle}>
                Create a password to secure your wallet
              </Text>
            </View>

            {/* Password Inputs */}
            <View style={styles.inputContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordInputWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter password (min 6 characters)"
                    placeholderTextColor="#6B7280"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <View style={styles.passwordInputWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter password"
                    placeholderTextColor="#6B7280"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Password Requirements */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#60A5FA" />
              <Text style={styles.infoText}>
                Password must be at least 6 characters long. This password will be required each time you open the app.
              </Text>
            </View>

            {/* Create Wallet Button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handlePasswordSetup}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Creating Wallet...' : 'Create Wallet'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 16,
  },
  backButtonText: {
    color: '#7C3AED',
    fontSize: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 24,
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  input: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#7C3AED',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16,
  },
  eyeIcon: {
    padding: 12,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    color: '#93C5FD',
    fontSize: 14,
    lineHeight: 20,
  },
});
