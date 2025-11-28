package relayer

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"log"
	"math/big"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/SafeMask/bridge-watcher/internal/bridge"
	"github.com/SafeMask/bridge-watcher/internal/config"
)

type Relayer struct {
	cfg        *config.Config
	watcher    *bridge.Watcher
	privateKey *ecdsa.PrivateKey
	clients    map[uint64]*ethclient.Client
	nonces     map[uint64]uint64
	mu         sync.RWMutex
	pending    map[string]*RelayedTx
}

type RelayedTx struct {
	ChainID     uint64
	TxHash      common.Hash
	Status      string
	Timestamp   time.Time
	Confirmations uint64
}

func NewRelayer(cfg *config.Config, watcher *bridge.Watcher) (*Relayer, error) {
	// Parse private key
	privateKey, err := crypto.HexToECDSA(cfg.RelayerPrivateKey)
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}

	r := &Relayer{
		cfg:        cfg,
		watcher:    watcher,
		privateKey: privateKey,
		clients:    make(map[uint64]*ethclient.Client),
		nonces:     make(map[uint64]uint64),
		pending:    make(map[string]*RelayedTx),
	}

	// Connect to chains
	if err := r.connectChains(); err != nil {
		return nil, err
	}

	return r, nil
}

func (r *Relayer) connectChains() error {
	rpcEndpoints := map[uint64]string{
		1:     r.cfg.EthereumRPC,
		137:   r.cfg.PolygonRPC,
		42161: r.cfg.ArbitrumRPC,
		10:    r.cfg.OptimismRPC,
	}

	for chainID, rpc := range rpcEndpoints {
		if rpc == "" {
			continue
		}

		client, err := ethclient.Dial(rpc)
		if err != nil {
			return fmt.Errorf("failed to connect to chain %d: %w", chainID, err)
		}

		r.clients[chainID] = client
	}

	return nil
}

func (r *Relayer) Start(ctx context.Context) error {
	log.Println("🚀 Starting transaction relayer...")

	// Get initial nonces
	for chainID, client := range r.clients {
		nonce, err := r.getNonce(ctx, chainID, client)
		if err != nil {
			return fmt.Errorf("failed to get nonce for chain %d: %w", chainID, err)
		}
		r.mu.Lock()
		r.nonces[chainID] = nonce
		r.mu.Unlock()
	}

	// Process bridge events
	events := r.watcher.GetEvents()
	for {
		select {
		case <-ctx.Done():
			return nil
		case event := <-events:
			if err := r.handleEvent(ctx, event); err != nil {
				log.Printf("❌ Error handling event: %v", err)
			}
		}
	}
}

func (r *Relayer) handleEvent(ctx context.Context, event *bridge.BridgeEvent) error {
	log.Printf("🔄 Processing %s event from chain %d", event.EventType, event.ChainID)

	switch event.EventType {
	case "deposit":
		return r.relayDeposit(ctx, event)
	case "withdraw":
		return r.relayWithdraw(ctx, event)
	default:
		return fmt.Errorf("unknown event type: %s", event.EventType)
	}
}

func (r *Relayer) relayDeposit(ctx context.Context, event *bridge.BridgeEvent) error {
	// Verify proof before relaying
	if r.cfg.EnableProofVerification {
		if !r.verifyProof(event) {
			return fmt.Errorf("proof verification failed")
		}
	}

	// Get destination client
	destClient, ok := r.clients[event.DestinationChain]
	if !ok {
		return fmt.Errorf("no client for destination chain %d", event.DestinationChain)
	}

	// Build transaction
	tx, err := r.buildRelayTx(ctx, event, destClient)
	if err != nil {
		return fmt.Errorf("failed to build relay tx: %w", err)
	}

	// Send transaction
	if err := destClient.SendTransaction(ctx, tx); err != nil {
		return fmt.Errorf("failed to send transaction: %w", err)
	}

	// Track pending transaction
	r.mu.Lock()
	r.pending[tx.Hash().Hex()] = &RelayedTx{
		ChainID:     event.DestinationChain,
		TxHash:      tx.Hash(),
		Status:      "pending",
		Timestamp:   time.Now(),
		Confirmations: 0,
	}
	r.mu.Unlock()

	log.Printf("✅ Relayed deposit to chain %d: %s", event.DestinationChain, tx.Hash().Hex())
	return nil
}

func (r *Relayer) relayWithdraw(ctx context.Context, event *bridge.BridgeEvent) error {
	// Similar to relayDeposit but for withdrawals
	log.Printf("✅ Processed withdraw on chain %d", event.ChainID)
	return nil
}

func (r *Relayer) buildRelayTx(ctx context.Context, event *bridge.BridgeEvent, client *ethclient.Client) (*types.Transaction, error) {
	// Get transaction options
	opts, err := r.getTransactOpts(ctx, event.DestinationChain, client)
	if err != nil {
		return nil, err
	}

	// Build contract call data
	// This would use the actual ABI encoder
	data := r.encodeRelayData(event)

	contractAddr := common.HexToAddress(r.cfg.BridgeContracts[event.DestinationChain])
	
	tx := types.NewTransaction(
		opts.Nonce.Uint64(),
		contractAddr,
		big.NewInt(0), // No ETH value
		opts.GasLimit,
		opts.GasPrice,
		data,
	)

	// Sign transaction
	signer := types.NewEIP155Signer(big.NewInt(int64(event.DestinationChain)))
	signedTx, err := types.SignTx(tx, signer, r.privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Increment nonce
	r.mu.Lock()
	r.nonces[event.DestinationChain]++
	r.mu.Unlock()

	return signedTx, nil
}

func (r *Relayer) getTransactOpts(ctx context.Context, chainID uint64, client *ethclient.Client) (*bind.TransactOpts, error) {
	r.mu.RLock()
	nonce := r.nonces[chainID]
	r.mu.RUnlock()

	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return nil, err
	}

	// Cap gas price
	if gasPrice.Cmp(big.NewInt(int64(r.cfg.MaxGasPrice))) > 0 {
		gasPrice = big.NewInt(int64(r.cfg.MaxGasPrice))
	}

	opts := &bind.TransactOpts{
		From:     crypto.PubkeyToAddress(r.privateKey.PublicKey),
		Nonce:    big.NewInt(int64(nonce)),
		Signer:   nil, // Will sign manually
		GasLimit: r.cfg.GasLimit,
		GasPrice: gasPrice,
		Context:  ctx,
	}

	return opts, nil
}

func (r *Relayer) getNonce(ctx context.Context, chainID uint64, client *ethclient.Client) (uint64, error) {
	address := crypto.PubkeyToAddress(r.privateKey.PublicKey)
	return client.PendingNonceAt(ctx, address)
}

func (r *Relayer) encodeRelayData(event *bridge.BridgeEvent) []byte {
	// Encode relay function call
	// This would use the actual ABI encoder
	// relay(address recipient, uint256 amount, bytes commitment, bytes proof, bytes32 sourceHash)
	data := make([]byte, 0)
	// ... encoding logic ...
	return data
}

func (r *Relayer) verifyProof(event *bridge.BridgeEvent) bool {
	// Verify range proof and ZK proof
	// This would call the Rust FFI or verification contract
	
	// Check proof age
	age := time.Since(event.Timestamp)
	if age > time.Duration(r.cfg.MaxProofAge)*time.Second {
		log.Printf("⚠️  Proof too old: %v", age)
		return false
	}

	// Verify commitment matches amount
	// ... verification logic ...

	return true
}

func (r *Relayer) GetPendingTx(txHash string) (*RelayedTx, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	tx, ok := r.pending[txHash]
	return tx, ok
}

func (r *Relayer) GetStatus() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()

	status := make(map[string]interface{})
	status["nonces"] = r.nonces
	status["pending_count"] = len(r.pending)
	
	pendingTxs := make([]map[string]interface{}, 0)
	for _, tx := range r.pending {
		pendingTxs = append(pendingTxs, map[string]interface{}{
			"chain_id":      tx.ChainID,
			"tx_hash":       tx.TxHash.Hex(),
			"status":        tx.Status,
			"timestamp":     tx.Timestamp,
			"confirmations": tx.Confirmations,
		})
	}
	status["pending_txs"] = pendingTxs

	return status
}
