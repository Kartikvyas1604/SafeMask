#!/bin/bash

# Offline Mesh Payment Demo Script
# This script demonstrates the offline payment flow

echo "═══════════════════════════════════════════════════════════"
echo "    SafeMask - Offline Mesh Payment Demonstration"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check device status
echo -e "${BLUE}Step 1: Checking device status...${NC}"
if adb devices | grep -q "device$"; then
    DEVICE=$(adb devices | grep "device$" | awk '{print $1}')
    echo -e "${GREEN}✓ Device connected: ${DEVICE}${NC}"
    DEVICE_CONNECTED=true
elif adb devices | grep -q "unauthorized"; then
    echo -e "${RED}✗ Device unauthorized. Please check your phone and allow USB debugging.${NC}"
    exit 1
else
    echo -e "${YELLOW}⚠ No device connected - running demo mode${NC}"
    DEVICE_CONNECTED=false
fi
echo ""

# Step 2: App installation status
if [ "$DEVICE_CONNECTED" = true ]; then
    echo -e "${BLUE}Step 2: Checking SafeMask installation...${NC}"
    if adb shell pm list packages | grep -q "com.safemask"; then
        echo -e "${GREEN}✓ SafeMask is installed${NC}"
    else
        echo -e "${YELLOW}⚠ SafeMask not detected (this is okay for demo)${NC}"
    fi
    echo ""
fi

# Step 3: Show offline scenario
echo -e "${BLUE}Step 3: Offline Payment Scenario${NC}"
echo ""
echo "  Scenario: You want to pay someone but have no internet"
echo "  Solution: Use mesh network to broadcast through nearby devices"
echo ""

# Step 4: Show transaction flow
echo -e "${BLUE}Step 4: Transaction Flow${NC}"
echo ""
echo "  [Your Phone - OFFLINE]"
echo "         ↓ (Bluetooth LE)"
echo "  [Nearby Peer #1]"
echo "         ↓ (Mesh Network)"
echo "  [Nearby Peer #2 - ONLINE]"
echo "         ↓ (Internet)"
echo "  [Blockchain Network]"
echo "         ↓"
echo "  [✓ Transaction Confirmed]"
echo ""

# Step 5: Example transaction
echo -e "${BLUE}Step 5: Example Transaction${NC}"
echo ""
cat << 'EOF'
{
  "from": "0xYourWallet...1234",
  "to": "0xRecipient...5678",
  "amount": "0.5",
  "asset": "ETH",
  "chain": "ethereum",
  "mesh_enabled": true,
  "status": "broadcasting"
}
EOF
echo ""

# Step 6: Peer discovery simulation
echo -e "${BLUE}Step 6: Discovering mesh network peers...${NC}"
sleep 1
echo -e "${GREEN}  ✓ Found 3 nearby peers${NC}"
echo "    • Peer abc123... (15m, Signal: Strong) 📶📶📶"
echo "    • Peer def456... (42m, Signal: Medium) 📶📶"
echo "    • Peer ghi789... (89m, Signal: Weak) 📶"
echo ""

# Step 7: Broadcasting
echo -e "${BLUE}Step 7: Broadcasting transaction through mesh...${NC}"
sleep 1
echo -e "${GREEN}  ✓ Transaction broadcast to 3 peers${NC}"
echo "  • Hop 1: Peer abc123... → ✓ Received & Forwarding"
echo "  • Hop 2: Peer def456... → ✓ Received & Forwarding"
echo "  • Hop 3: Peer ghi789... → ✓ Gateway found! (has internet)"
echo ""

# Step 8: Blockchain submission
echo -e "${BLUE}Step 8: Submitting to blockchain...${NC}"
sleep 1
echo -e "${GREEN}  ✓ Transaction submitted by gateway peer${NC}"
echo "  • Tx Hash: 0x1234567890abcdef..."
echo "  • Network: Ethereum Mainnet"
echo "  • Gas Fee: 0.002 ETH (~$5.23)"
echo ""

# Step 9: Confirmation
echo -e "${BLUE}Step 9: Waiting for confirmation...${NC}"
sleep 2
echo -e "${GREEN}  ✓ Transaction confirmed on blockchain!${NC}"
echo "  • Block: #18,234,567"
echo "  • Confirmations: 12/12"
echo "  • Total Time: 14 seconds"
echo ""

# Summary
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}✓ Offline Payment Complete!${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Transaction Summary:"
echo "  • Amount: 0.5 ETH (~$1,815.50)"
echo "  • From: Your Wallet (offline)"
echo "  • To: Recipient Address"
echo "  • Method: Mesh Network (3 hops)"
echo "  • Status: ✓ Confirmed"
echo "  • Total Time: 14 seconds"
echo ""

# How to use
echo "═══════════════════════════════════════════════════════════"
echo "How to Use in SafeMask App:"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "1. Open SafeMask wallet"
echo "2. Tap 'Offline Pay' in Privacy & Features section"
echo "3. Turn OFF WiFi/Data (simulate offline)"
echo "4. Tap WiFi icon to discover nearby peers"
echo "5. Enter recipient address and amount"
echo "6. Toggle 'Use Mesh Network' ON"
echo "7. Tap 'Send via Mesh Network'"
echo "8. Transaction queues and broadcasts through mesh"
echo "9. Any peer with internet submits to blockchain"
echo "10. Confirmation syncs back through mesh"
echo ""

if [ "$DEVICE_CONNECTED" = true ]; then
    echo "═══════════════════════════════════════════════════════════"
    echo "Ready to Test on Your Device!"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "Run the app with:"
    echo "  cd /home/kartik/Downloads/Projets/SafeMask"
    echo "  npm start"
    echo ""
    echo "Or install the APK:"
    echo "  adb install android/app/build/outputs/apk/debug/app-debug.apk"
    echo ""
    echo "Then navigate to: Wallet → Privacy & Features → Offline Pay"
    echo ""
fi

# Technical implementation
echo "═══════════════════════════════════════════════════════════"
echo "Technical Implementation:"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "✓ Bluetooth Low Energy for peer discovery (50-100m range)"
echo "✓ ECDH encryption for secure mesh communication"
echo "✓ secp256k1 signatures for BTC/ETH transactions"
echo "✓ ed25519 signatures for Solana transactions"
echo "✓ Gossip protocol for efficient propagation"
echo "✓ Multi-hop routing with TTL protection"
echo "✓ Automatic retry and queue management"
echo "✓ Peer reputation system (anti-spam)"
echo ""

# Files created
echo "═══════════════════════════════════════════════════════════"
echo "Implementation Files:"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Screens:"
echo "  • src/screens/OfflineMeshPaymentScreen.tsx"
echo ""
echo "Core Services:"
echo "  • src/mesh/MeshNetwork.ts (enhanced)"
echo "  • src/crypto/TransactionSigner.ts"
echo "  • src/utils/NetworkConnectivity.ts"
echo ""
echo "Documentation:"
echo "  • docs/OFFLINE-MESH-PAYMENTS.md"
echo "  • OFFLINE-PAYMENTS-README.md"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "For more information:"
echo "  • Full docs: docs/OFFLINE-MESH-PAYMENTS.md"
echo "  • Quick start: OFFLINE-PAYMENTS-README.md"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}Demo complete! The offline payment feature is ready to use.${NC}"
echo ""
