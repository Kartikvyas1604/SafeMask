import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { BridgeService } from '../bridge/BridgeService';
import ZKProofService from '../privacy/ZKProofService';

interface Network {
  id: string;
  name: string;
  chainId: number;
  icon: string;
}

const NETWORKS: Network[] = [
  { id: 'ethereum', name: 'Ethereum', chainId: 1, icon: '⟠' },
  { id: 'polygon', name: 'Polygon', chainId: 137, icon: '⬡' },
  { id: 'arbitrum', name: 'Arbitrum', chainId: 42161, icon: '◆' },
  { id: 'optimism', name: 'Optimism', chainId: 10, icon: '🔴' },
  { id: 'base', name: 'Base', chainId: 8453, icon: '🔵' },
];

export const BridgeScreen: React.FC = () => {
  const [fromNetwork, setFromNetwork] = useState<Network>(NETWORKS[0]);
  const [toNetwork, setToNetwork] = useState<Network>(NETWORKS[1]);
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [bridging, setBridging] = useState(false);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [bridgeService] = useState(() => new BridgeService());

  useEffect(() => {
    // Initialize bridge networks
    initializeBridge();
    loadPendingTransfers();
  }, []);

  const initializeBridge = async () => {
    try {
      // Add networks (in real app, get RPC URLs from config)
      for (const network of NETWORKS) {
        bridgeService.addNetwork({
          network: network.id as any,
          rpcUrl: `https://${network.name.toLowerCase()}.infura.io/v3/YOUR_KEY`,
          bridgeContractAddress: '0xBridgeContractAddress',
          confirmations: 12,
        });
      }
    } catch (error) {
      console.error('Failed to initialize bridge:', error);
    }
  };

  const loadPendingTransfers = () => {
    // In real app, get from all networks
    const pending: any[] = [];
    setTransfers(pending);
  };

  const handleBridge = async () => {
    if (!amount || !recipient) {
      Alert.alert('Error', 'Please enter amount and recipient address');
      return;
    }

    if (fromNetwork.id === toNetwork.id) {
      Alert.alert('Error', 'Source and destination networks must be different');
      return;
    }

    setBridging(true);

    try {
      // Generate ZK proof for private transfer
      // In real app, use actual ZK proof generation
      const zkProof = {
        proof: 'mock-proof',
        publicSignals: [],
      };

      // Initiate bridge transfer
      // In production, would use actual wallet signer
      // For now, just create a mock transfer
      const transferId = `tx_${Date.now()}`;
      
      setTransfers([...transfers, {
        id: transferId,
        sourceChain: fromNetwork.name,
        destinationChain: toNetwork.name,
        amount,
        recipient,
        status: 'pending',
      }]);

      Alert.alert(
        'Transfer Initiated',
        `Transfer ID: ${transferId.slice(0, 8)}...\n\nYour transfer is being processed. It will be completed automatically once confirmed on the source chain.`
      );

      // Clear form
      setAmount('');
      setRecipient('');
      loadPendingTransfers();
    } catch (error) {
      Alert.alert('Error', `Failed to initiate transfer: ${error}`);
    } finally {
      setBridging(false);
    }
  };

  const swapNetworks = () => {
    const temp = fromNetwork;
    setFromNetwork(toNetwork);
    setToNetwork(temp);
  };

  const renderNetworkSelector = (
    network: Network,
    onSelect: (network: Network) => void,
    label: string
  ) => (
    <View style={styles.networkSelector}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {NETWORKS.map((net) => (
          <TouchableOpacity
            key={net.id}
            style={[
              styles.networkButton,
              network.id === net.id && styles.networkButtonActive,
            ]}
            onPress={() => onSelect(net)}
          >
            <Text style={styles.networkIcon}>{net.icon}</Text>
            <Text style={styles.networkName}>{net.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderTransferItem = (transfer: { id: string; status: string; sourceChain: string; destinationChain: string; amount: string; recipient: string }) => (
    <View key={transfer.id} style={styles.transferItem}>
      <View style={styles.transferHeader}>
        <Text style={styles.transferId}>
          {transfer.id.slice(0, 8)}...{transfer.id.slice(-6)}
        </Text>
        <View style={[
          styles.statusBadge,
          transfer.status === 'pending' && styles.status_pending,
          transfer.status === 'processing' && styles.status_processing,
          transfer.status === 'completed' && styles.status_completed,
        ]}>
          <Text style={styles.statusText}>{transfer.status}</Text>
        </View>
      </View>
      <View style={styles.transferDetails}>
        <Text style={styles.transferRoute}>
          {transfer.sourceChain} → {transfer.destinationChain}
        </Text>
        <Text style={styles.transferAmount}>{transfer.amount} ETH</Text>
      </View>
      <Text style={styles.transferRecipient}>To: {transfer.recipient}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cross-Chain Bridge</Text>
        <Text style={styles.subtitle}>
          Transfer assets between networks with zero-knowledge privacy
        </Text>
      </View>

      <View style={styles.bridgeCard}>
        {renderNetworkSelector(fromNetwork, setFromNetwork, 'From')}

        <TouchableOpacity style={styles.swapButton} onPress={swapNetworks}>
          <Text style={styles.swapIcon}>⇅</Text>
        </TouchableOpacity>

        {renderNetworkSelector(toNetwork, setToNetwork, 'To')}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            placeholder="0.0"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Recipient Address</Text>
          <TextInput
            style={styles.input}
            placeholder="0x..."
            value={recipient}
            onChangeText={setRecipient}
            placeholderTextColor="#666"
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={[styles.bridgeButton, bridging && styles.bridgeButtonDisabled]}
          onPress={handleBridge}
          disabled={bridging}
        >
          {bridging ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bridgeButtonText}>Bridge Assets</Text>
          )}
        </TouchableOpacity>

        <View style={styles.privacyNote}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={styles.privacyText}>
            Your transfer is protected with zero-knowledge proofs
          </Text>
        </View>
      </View>

      {transfers.length > 0 && (
        <View style={styles.transfersSection}>
          <Text style={styles.sectionTitle}>Pending Transfers</Text>
          {transfers.map(renderTransferItem)}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
  },
  bridgeCard: {
    margin: 20,
    marginTop: 0,
    padding: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  networkSelector: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
    fontWeight: '600',
  },
  networkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    marginRight: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
  },
  networkButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#1a3a1a',
  },
  networkIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  networkName: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  swapButton: {
    alignSelf: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
    borderWidth: 2,
    borderColor: '#333',
  },
  swapIcon: {
    fontSize: 24,
    color: '#fff',
  },
  inputGroup: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 2,
    borderColor: '#333',
  },
  bridgeButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  bridgeButtonDisabled: {
    opacity: 0.5,
  },
  bridgeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#1a1a2a',
    borderRadius: 8,
  },
  privacyIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: '#888',
  },
  transfersSection: {
    margin: 20,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  transferItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  transferHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  transferId: {
    fontSize: 14,
    color: '#888',
    fontFamily: 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  status_pending: {
    backgroundColor: '#4a3a0a',
  },
  status_processing: {
    backgroundColor: '#0a2a4a',
  },
  status_completed: {
    backgroundColor: '#0a4a1a',
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  transferDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transferRoute: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  transferAmount: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  transferRecipient: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
});
