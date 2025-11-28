#!/bin/bash
# Circuit Compilation Script for SafeMask
# Compiles Circom circuits to R1CS, WASM, and generates ZKeys

set -e

CIRCUITS_DIR="./circuits"
BUILD_DIR="./circuits/build"
CIRCOM_DIR="./circuits/circom"
PTAU_URL="https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau"
PTAU_FILE="$BUILD_DIR/powersOfTau28_hez_final_16.ptau"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}SafeMask Circuit Compilation${NC}"
echo "================================"

# Create build directory
mkdir -p "$BUILD_DIR"

# Download Powers of Tau if not exists
if [ ! -f "$PTAU_FILE" ]; then
    echo -e "${YELLOW}Downloading Powers of Tau ceremony file...${NC}"
    curl -o "$PTAU_FILE" "$PTAU_URL"
    echo -e "${GREEN}✓ Downloaded Powers of Tau${NC}"
else
    echo -e "${GREEN}✓ Powers of Tau file exists${NC}"
fi

# Function to compile a circuit
compile_circuit() {
    local circuit_name=$1
    local circuit_file="$CIRCOM_DIR/${circuit_name}.circom"
    local output_dir="$BUILD_DIR/$circuit_name"
    
    echo ""
    echo -e "${YELLOW}Compiling $circuit_name...${NC}"
    
    # Create output directory
    mkdir -p "$output_dir"
    
    # Compile circuit to R1CS, WASM, and SYM
    echo "  - Generating R1CS and WASM..."
    circom "$circuit_file" \
        --r1cs --wasm --sym \
        -o "$output_dir" \
        2>&1 | grep -v "template instances"
    
    # Move WASM to correct location
    if [ -d "$output_dir/${circuit_name}_js" ]; then
        mv "$output_dir/${circuit_name}_js/${circuit_name}.wasm" "$output_dir/circuit.wasm"
        rm -rf "$output_dir/${circuit_name}_js"
    fi
    
    # Rename R1CS
    if [ -f "$output_dir/${circuit_name}.r1cs" ]; then
        mv "$output_dir/${circuit_name}.r1cs" "$output_dir/circuit.r1cs"
    fi
    
    echo "  - Running Groth16 setup..."
    snarkjs groth16 setup \
        "$output_dir/circuit.r1cs" \
        "$PTAU_FILE" \
        "$output_dir/circuit_0000.zkey" \
        > /dev/null 2>&1
    
    # Contribute to the ceremony (Phase 2)
    echo "  - Contributing to Phase 2 ceremony..."
    echo "SafeMask-contribution" | snarkjs zkey contribute \
        "$output_dir/circuit_0000.zkey" \
        "$output_dir/circuit_final.zkey" \
        --name="SafeMask Contribution" \
        > /dev/null 2>&1
    
    # Export verification key
    echo "  - Exporting verification key..."
    snarkjs zkey export verificationkey \
        "$output_dir/circuit_final.zkey" \
        "$output_dir/verification_key.json" \
        > /dev/null 2>&1
    
    # Export Solidity verifier
    echo "  - Generating Solidity verifier..."
    snarkjs zkey export solidityverifier \
        "$output_dir/circuit_final.zkey" \
        "$output_dir/verifier.sol" \
        > /dev/null 2>&1
    
    # Clean up intermediate files
    rm -f "$output_dir/circuit_0000.zkey"
    rm -f "$output_dir/${circuit_name}.sym"
    
    echo -e "${GREEN}✓ $circuit_name compiled successfully${NC}"
}

# Compile all circuits
circuits=(
    "confidential_transfer"
    "range_proof"
    "nullifier"
    "stealth_address"
    "merkle_membership"
    "private_swap"
)

for circuit in "${circuits[@]}"; do
    if [ -f "$CIRCOM_DIR/$circuit.circom" ]; then
        compile_circuit "$circuit"
    else
        echo -e "${RED}⚠ Circuit file not found: $circuit.circom${NC}"
    fi
done

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}All circuits compiled!${NC}"
echo ""
echo "Build artifacts location: $BUILD_DIR"
echo ""
echo "Next steps:"
echo "  1. Run tests: npm test"
echo "  2. Deploy verifiers: cd contracts && npx hardhat run scripts/deploy.js"
echo ""
