#!/bin/bash

# Circuit Compilation Script
# Compiles all Circom circuits for production

set -e

echo "=== SafeMask Circuit Compilation ==="

# Check if circom is installed
if ! command -v circom &> /dev/null; then
    echo "Error: Circom is not installed"
    echo "Install from: https://docs.circom.io/getting-started/installation/"
    exit 1
fi

# Check if snarkjs is installed
if ! command -v snarkjs &> /dev/null; then
    echo "Installing snarkjs..."
    npm install -g snarkjs
fi

cd circuits

# Create build directory
mkdir -p build

# Download Powers of Tau if not exists
if [ ! -f "powersOfTau28_hez_final_16.ptau" ]; then
    echo "Downloading Powers of Tau ceremony file..."
    wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_16.ptau
fi

echo ""
echo "Compiling circuits..."

# Compile each circuit
for circuit_file in circom/*.circom; do
    circuit_name=$(basename "$circuit_file" .circom)
    echo ""
    echo "=== Compiling $circuit_name ==="
    
    # Compile circuit
    circom "$circuit_file" --r1cs --wasm --sym -o build/
    
    # Generate witness calculator
    echo "Generating witness calculator..."
    
    # Setup ceremony (trusted setup)
    echo "Running trusted setup..."
    snarkjs groth16 setup \
        "build/${circuit_name}.r1cs" \
        powersOfTau28_hez_final_16.ptau \
        "build/${circuit_name}_0000.zkey"
    
    # Contribute to phase 2 ceremony
    echo "Contributing to ceremony..."
    snarkjs zkey contribute \
        "build/${circuit_name}_0000.zkey" \
        "build/${circuit_name}_final.zkey" \
        --name="SafeMask" \
        -e="$(date +%s)"
    
    # Export verification key
    echo "Exporting verification key..."
    snarkjs zkey export verificationkey \
        "build/${circuit_name}_final.zkey" \
        "build/${circuit_name}_verification_key.json"
    
    # Export Solidity verifier
    echo "Generating Solidity verifier..."
    snarkjs zkey export solidityverifier \
        "build/${circuit_name}_final.zkey" \
        "build/${circuit_name}Verifier.sol"
    
    # Get circuit info
    snarkjs r1cs info "build/${circuit_name}.r1cs"
    
    echo "✓ $circuit_name compiled successfully"
done

echo ""
echo "=== Compilation Complete ==="
echo "Generated files:"
ls -lh build/*.zkey
ls -lh build/*_verification_key.json
ls -lh build/*.sol

echo ""
echo "Circuits are ready for production use!"
