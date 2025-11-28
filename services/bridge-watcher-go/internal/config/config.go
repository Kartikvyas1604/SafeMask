package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	// Server
	ServerPort string
	ServerHost string

	// Blockchain RPC endpoints
	EthereumRPC string
	PolygonRPC  string
	ArbitrumRPC string
	OptimismRPC string

	// Chain IDs
	ChainIDs []uint64

	// Contract addresses
	BridgeContracts map[uint64]string

	// Database
	DatabaseURL string
	RedisURL    string

	// Relayer
	RelayerPrivateKey string
	GasLimit          uint64
	MaxGasPrice       uint64

	// Monitoring
	BlockConfirmations uint64
	PollInterval       uint64 // seconds
	MaxRetries         int

	// Privacy
	EnableProofVerification bool
	MaxProofAge             uint64 // seconds
}

func Load() (*Config, error) {
	cfg := &Config{
		ServerPort: getEnv("SERVER_PORT", "8080"),
		ServerHost: getEnv("SERVER_HOST", "0.0.0.0"),

		EthereumRPC: getEnv("ETHEREUM_RPC", ""),
		PolygonRPC:  getEnv("POLYGON_RPC", ""),
		ArbitrumRPC: getEnv("ARBITRUM_RPC", ""),
		OptimismRPC: getEnv("OPTIMISM_RPC", ""),

		DatabaseURL: getEnv("DATABASE_URL", "postgres://localhost:5432/SafeMask"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),

		RelayerPrivateKey: getEnv("RELAYER_PRIVATE_KEY", ""),
		GasLimit:          getEnvUint64("GAS_LIMIT", 500000),
		MaxGasPrice:       getEnvUint64("MAX_GAS_PRICE", 100000000000), // 100 gwei

		BlockConfirmations: getEnvUint64("BLOCK_CONFIRMATIONS", 12),
		PollInterval:       getEnvUint64("POLL_INTERVAL", 12),
		MaxRetries:         getEnvInt("MAX_RETRIES", 3),

		EnableProofVerification: getEnvBool("ENABLE_PROOF_VERIFICATION", true),
		MaxProofAge:             getEnvUint64("MAX_PROOF_AGE", 3600), // 1 hour
	}

	// Parse chain IDs
	chainIDsStr := getEnv("CHAIN_IDS", "1,137,42161,10")
	for _, idStr := range strings.Split(chainIDsStr, ",") {
		id, err := strconv.ParseUint(strings.TrimSpace(idStr), 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid chain ID: %s", idStr)
		}
		cfg.ChainIDs = append(cfg.ChainIDs, id)
	}

	// Parse bridge contracts
	cfg.BridgeContracts = make(map[uint64]string)
	cfg.BridgeContracts[1] = getEnv("BRIDGE_CONTRACT_ETH", "")
	cfg.BridgeContracts[137] = getEnv("BRIDGE_CONTRACT_POLYGON", "")
	cfg.BridgeContracts[42161] = getEnv("BRIDGE_CONTRACT_ARBITRUM", "")
	cfg.BridgeContracts[10] = getEnv("BRIDGE_CONTRACT_OPTIMISM", "")

	// Validate required fields
	if cfg.RelayerPrivateKey == "" {
		return nil, fmt.Errorf("RELAYER_PRIVATE_KEY is required")
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvUint64(key string, defaultValue uint64) uint64 {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseUint(value, 10, 64); err == nil {
			return parsed
		}
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}
