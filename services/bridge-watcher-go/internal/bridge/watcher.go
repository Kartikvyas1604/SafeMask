package bridge

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/SafeMask/bridge-watcher/internal/config"
)

type BridgeEvent struct {
	ChainID         uint64
	TxHash          common.Hash
	BlockNumber     uint64
	EventType       string
	Sender          common.Address
	Recipient       common.Address
	Amount          *big.Int
	Commitment      []byte
	RangeProof      []byte
	Nullifier       []byte
	DestinationChain uint64
	Timestamp       time.Time
}

type Watcher struct {
	cfg      *config.Config
	clients  map[uint64]*ethclient.Client
	events   chan *BridgeEvent
	mu       sync.RWMutex
	lastBlock map[uint64]uint64
}

func NewWatcher(cfg *config.Config) (*Watcher, error) {
	w := &Watcher{
		cfg:       cfg,
		clients:   make(map[uint64]*ethclient.Client),
		events:    make(chan *BridgeEvent, 100),
		lastBlock: make(map[uint64]uint64),
	}

	// Connect to all chains
	if err := w.connectChains(); err != nil {
		return nil, err
	}

	return w, nil
}

func (w *Watcher) connectChains() error {
	rpcEndpoints := map[uint64]string{
		1:     w.cfg.EthereumRPC,
		137:   w.cfg.PolygonRPC,
		42161: w.cfg.ArbitrumRPC,
		10:    w.cfg.OptimismRPC,
	}

	for chainID, rpc := range rpcEndpoints {
		if rpc == "" {
			continue
		}

		client, err := ethclient.Dial(rpc)
		if err != nil {
			return fmt.Errorf("failed to connect to chain %d: %w", chainID, err)
		}

		w.clients[chainID] = client
		log.Printf("✅ Connected to chain %d", chainID)
	}

	return nil
}

func (w *Watcher) Start(ctx context.Context) error {
	log.Println("🔍 Starting bridge event monitoring...")

	var wg sync.WaitGroup
	for chainID, client := range w.clients {
		wg.Add(1)
		go func(cid uint64, cli *ethclient.Client) {
			defer wg.Done()
			w.watchChain(ctx, cid, cli)
		}(chainID, client)
	}

	wg.Wait()
	return nil
}

func (w *Watcher) watchChain(ctx context.Context, chainID uint64, client *ethclient.Client) {
	ticker := time.NewTicker(time.Duration(w.cfg.PollInterval) * time.Second)
	defer ticker.Stop()

	contractAddr := common.HexToAddress(w.cfg.BridgeContracts[chainID])
	if contractAddr == (common.Address{}) {
		log.Printf("⚠️  No bridge contract for chain %d", chainID)
		return
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := w.processNewBlocks(ctx, chainID, client, contractAddr); err != nil {
				log.Printf("❌ Error processing blocks for chain %d: %v", chainID, err)
			}
		}
	}
}

func (w *Watcher) processNewBlocks(ctx context.Context, chainID uint64, client *ethclient.Client, contractAddr common.Address) error {
	// Get current block number
	currentBlock, err := client.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("failed to get block number: %w", err)
	}

	// Get last processed block
	w.mu.RLock()
	lastBlock := w.lastBlock[chainID]
	w.mu.RUnlock()

	if lastBlock == 0 {
		// Initialize with current block minus confirmation blocks
		lastBlock = currentBlock - w.cfg.BlockConfirmations
	}

	// Calculate block range to process
	fromBlock := lastBlock + 1
	toBlock := currentBlock - w.cfg.BlockConfirmations

	if fromBlock > toBlock {
		return nil // No new blocks to process
	}

	// Query logs
	query := ethereum.FilterQuery{
		FromBlock: big.NewInt(int64(fromBlock)),
		ToBlock:   big.NewInt(int64(toBlock)),
		Addresses: []common.Address{contractAddr},
	}

	logs, err := client.FilterLogs(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to filter logs: %w", err)
	}

	// Process logs
	for _, vLog := range logs {
		if err := w.processLog(chainID, vLog); err != nil {
			log.Printf("❌ Error processing log: %v", err)
			continue
		}
	}

	// Update last processed block
	w.mu.Lock()
	w.lastBlock[chainID] = toBlock
	w.mu.Unlock()

	if len(logs) > 0 {
		log.Printf("📦 Processed %d events from chain %d (blocks %d-%d)", len(logs), chainID, fromBlock, toBlock)
	}

	return nil
}

func (w *Watcher) processLog(chainID uint64, vLog types.Log) error {
	// Parse event based on topic
	eventSig := vLog.Topics[0].Hex()

	var event *BridgeEvent
	var err error

	switch eventSig {
	case "0x1234...": // DepositEvent signature
		event, err = w.parseDepositEvent(chainID, vLog)
	case "0x5678...": // WithdrawEvent signature
		event, err = w.parseWithdrawEvent(chainID, vLog)
	default:
		return nil // Unknown event
	}

	if err != nil {
		return err
	}

	// Send event to channel
	select {
	case w.events <- event:
		log.Printf("🔔 New %s event on chain %d: %s", event.EventType, chainID, event.TxHash.Hex())
	default:
		log.Printf("⚠️  Event channel full, dropping event")
	}

	return nil
}

func (w *Watcher) parseDepositEvent(chainID uint64, vLog types.Log) (*BridgeEvent, error) {
	// Parse deposit event from log data
	// This is a simplified version - actual implementation would use ABI decoder
	return &BridgeEvent{
		ChainID:          chainID,
		TxHash:           vLog.TxHash,
		BlockNumber:      vLog.BlockNumber,
		EventType:        "deposit",
		Sender:           common.BytesToAddress(vLog.Topics[1].Bytes()),
		Amount:           new(big.Int).SetBytes(vLog.Data[0:32]),
		Commitment:       vLog.Data[32:64],
		RangeProof:       vLog.Data[64:192],
		DestinationChain: chainID,
		Timestamp:        time.Now(),
	}, nil
}

func (w *Watcher) parseWithdrawEvent(chainID uint64, vLog types.Log) (*BridgeEvent, error) {
	// Parse withdraw event from log data
	return &BridgeEvent{
		ChainID:     chainID,
		TxHash:      vLog.TxHash,
		BlockNumber: vLog.BlockNumber,
		EventType:   "withdraw",
		Recipient:   common.BytesToAddress(vLog.Topics[1].Bytes()),
		Amount:      new(big.Int).SetBytes(vLog.Data[0:32]),
		Commitment:  vLog.Data[32:64],
		Nullifier:   vLog.Data[64:96],
		Timestamp:   time.Now(),
	}, nil
}

func (w *Watcher) GetEvents() <-chan *BridgeEvent {
	return w.events
}

func (w *Watcher) GetLastBlock(chainID uint64) uint64 {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.lastBlock[chainID]
}

func (w *Watcher) GetStatus() map[string]interface{} {
	w.mu.RLock()
	defer w.mu.RUnlock()

	status := make(map[string]interface{})
	status["chains"] = make(map[uint64]interface{})

	for chainID, lastBlock := range w.lastBlock {
		chainStatus := make(map[string]interface{})
		chainStatus["last_block"] = lastBlock
		chainStatus["connected"] = w.clients[chainID] != nil
		status["chains"].(map[uint64]interface{})[chainID] = chainStatus
	}

	return status
}
