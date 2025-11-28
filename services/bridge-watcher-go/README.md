# SafeMask Bridge Watcher

Go service for monitoring cross-chain bridge events and relaying transactions with privacy preservation.

## Features

- **Multi-chain monitoring**: Ethereum, Polygon, Arbitrum, Optimism
- **Event detection**: Deposit, withdrawal, and transfer events
- **Automatic relaying**: Cross-chain transaction relay with proof verification
- **REST API**: Query bridge status and transactions
- **WebSocket**: Real-time event streaming
- **Privacy**: Range proof and ZK-SNARK verification before relay

## Architecture

```
┌─────────────────────────────────────────────┐
│           Bridge Watcher Service            │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Watcher  │  │ Relayer  │  │  Server  │ │
│  │          │  │          │  │  (HTTP)  │ │
│  │ Monitors │──│ Relays   │──│          │ │
│  │ Chains   │  │ Txs      │  │WebSocket │ │
│  └──────────┘  └──────────┘  └──────────┘ │
│        │            │              │        │
└────────┼────────────┼──────────────┼────────┘
         │            │              │
         ▼            ▼              ▼
    ETH/Polygon  Smart Contracts  Clients
    Arbitrum/OP  (Bridge)         (REST/WS)
```

## Installation

### Prerequisites

```bash
# Go 1.21+
go version

# PostgreSQL (optional)
brew install postgresql

# Redis (optional)
brew install redis
```

### Build

```bash
cd services/bridge-watcher-go
go mod download
go build -o bin/bridge-watcher main.go
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
nano .env
```

### Required Configuration

- `RELAYER_PRIVATE_KEY`: Private key for relaying transactions
- `ETHEREUM_RPC`: Ethereum RPC endpoint (Infura/Alchemy)
- `POLYGON_RPC`: Polygon RPC endpoint
- `BRIDGE_CONTRACT_ETH`: Ethereum bridge contract address
- `BRIDGE_CONTRACT_POLYGON`: Polygon bridge contract address

## Running

### Development

```bash
# Load environment variables
source .env

# Run with auto-reload
go run main.go
```

### Production

```bash
# Build binary
go build -o bin/bridge-watcher main.go

# Run
./bin/bridge-watcher
```

### Docker

```bash
# Build image
docker build -t SafeMask/bridge-watcher .

# Run container
docker run -p 8080:8080 --env-file .env SafeMask/bridge-watcher
```

## API Reference

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "time": "2025-11-18T12:00:00Z"
}
```

### Bridge Status

```bash
GET /api/v1/status
```

Response:
```json
{
  "watcher": {
    "chains": {
      "1": {"last_block": 18500000, "connected": true},
      "137": {"last_block": 49000000, "connected": true}
    }
  },
  "relayer": {
    "nonces": {"1": 42, "137": 18},
    "pending_count": 3
  },
  "ws_clients": 5
}
```

### Get Transaction

```bash
GET /api/v1/transactions/{txHash}
```

Response:
```json
{
  "chain_id": 137,
  "tx_hash": "0x1234...",
  "status": "confirmed",
  "timestamp": "2025-11-18T12:00:00Z",
  "confirmations": 15
}
```

### Submit Transaction

```bash
POST /api/v1/transactions
Content-Type: application/json

{
  "chain_id": 137,
  "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "amount": "1000000000000000000",
  "commitment": "0xabcd...",
  "range_proof": "0xef01..."
}
```

### Get Bridge Events

```bash
GET /api/v1/bridge/events?chain_id=1&limit=10
```

Response:
```json
{
  "events": [
    {
      "chain_id": 1,
      "event_type": "deposit",
      "tx_hash": "0x1234...",
      "timestamp": "2025-11-18T12:00:00Z"
    }
  ],
  "count": 10
}
```

## WebSocket

Connect to real-time event stream:

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onopen = () => {
  console.log('Connected');
  ws.send(JSON.stringify({ type: 'subscribe', chains: [1, 137] }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'bridge_event') {
    console.log('New event:', data.event);
  }
};
```

## Monitoring

### Prometheus Metrics

Expose metrics at `/metrics`:

- `bridge_events_total`: Total bridge events processed
- `relay_transactions_total`: Total transactions relayed
- `relay_failures_total`: Total relay failures
- `websocket_clients`: Current WebSocket connections

### Grafana Dashboard

Import dashboard from `grafana/bridge-watcher.json`

## Development

### Project Structure

```
bridge-watcher-go/
├── cmd/
│   └── bridge-watcher/
│       └── main.go
├── internal/
│   ├── bridge/
│   │   └── watcher.go
│   ├── config/
│   │   └── config.go
│   ├── relayer/
│   │   └── relayer.go
│   └── server/
│       └── server.go
├── pkg/
│   └── contracts/
│       └── bridge.go
├── go.mod
├── go.sum
└── README.md
```

### Testing

```bash
# Run tests
go test ./...

# Run with coverage
go test -cover ./...

# Run integration tests
go test -tags=integration ./...
```

### Linting

```bash
# Install golangci-lint
brew install golangci-lint

# Run linter
golangci-lint run
```

## Deployment

### Kubernetes

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

### Systemd

```bash
sudo cp bridge-watcher.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable bridge-watcher
sudo systemctl start bridge-watcher
```

## Security

- **Private Key**: Never commit `RELAYER_PRIVATE_KEY` to version control
- **Rate Limiting**: Configure rate limits for API endpoints
- **Authentication**: Add API key authentication for production
- **HTTPS**: Use TLS certificates in production
- **Proof Verification**: Enable `ENABLE_PROOF_VERIFICATION=true`

## Troubleshooting

### Connection Issues

```bash
# Check RPC endpoints
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  $ETHEREUM_RPC
```

### High Gas Fees

Adjust `MAX_GAS_PRICE` to cap gas costs:

```bash
MAX_GAS_PRICE=50000000000  # 50 gwei
```

### Missing Events

Increase `BLOCK_CONFIRMATIONS` for more reliable event detection:

```bash
BLOCK_CONFIRMATIONS=24
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests
4. Submit a pull request

## License

MIT License - see LICENSE file

## Support

- Documentation: https://docs.SafeMask.io
- Discord: https://discord.gg/SafeMask
- Email: support@SafeMask.io
