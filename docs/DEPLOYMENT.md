# SafeMask Deployment Guide

Complete guide for deploying SafeMask privacy wallet components to production.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Smart Contracts](#smart-contracts)
3. [Backend Services](#backend-services)
4. [Mobile App](#mobile-app)
5. [Monitoring](#monitoring)
6. [Security Checklist](#security-checklist)

## Prerequisites

### Infrastructure
- **Cloud Provider**: AWS/GCP/Azure
- **Kubernetes**: v1.27+ (recommended)
- **Database**: PostgreSQL 14+
- **Cache**: Redis 7+
- **Load Balancer**: NGINX/ALB

### Tools
```bash
# Install required tools
brew install kubectl helm terraform
npm install -g hardhat truffle
cargo install cargo-make
```

### Domain & SSL
- Register domain (e.g., `SafeMask.io`)
- Obtain SSL certificates (Let's Encrypt)
- Configure DNS records

## Smart Contracts

### 1. Compile Contracts
```bash
cd contracts
npm install
npx hardhat compile
```

### 2. Deploy to Testnet (Sepolia)
```bash
# Set environment variables
export PRIVATE_KEY="your_deployer_private_key"
export INFURA_KEY="your_infura_key"
export ETHERSCAN_API_KEY="your_etherscan_key"

# Deploy
npx hardhat run scripts/deploy.js --network sepolia

# Verify
npx hardhat verify --network sepolia \
  BULLETPROOF_VERIFIER_ADDRESS
npx hardhat verify --network sepolia \
  GROTH16_VERIFIER_ADDRESS
npx hardhat verify --network sepolia \
  CONFIDENTIAL_SWAP_ADDRESS \
  BULLETPROOF_VERIFIER_ADDRESS \
  FEE_COLLECTOR_ADDRESS
```

### 3. Deploy to Mainnet
```bash
# ⚠️ CRITICAL: Triple-check addresses before mainnet deployment

# Deploy with higher gas price
npx hardhat run scripts/deploy.js \
  --network mainnet \
  --gas-price 50000000000

# Save deployment addresses
cat deployments/mainnet.json
```

### 4. Post-Deployment
```bash
# Transfer ownership to multisig
npx hardhat run scripts/transfer-ownership.js --network mainnet

# Verify all contracts on Etherscan
npx hardhat verify --network mainnet <addresses>

# Test transactions on mainnet
npx hardhat run scripts/test-deployment.js --network mainnet
```

## Backend Services

### 1. Build Go Service
```bash
cd services/bridge-watcher-go

# Build binary
go build -o bin/bridge-watcher \
  -ldflags="-s -w" \
  main.go

# Or build Docker image
docker build -t SafeMask/bridge-watcher:latest .
docker push SafeMask/bridge-watcher:latest
```

### 2. Kubernetes Deployment
```bash
# Create namespace
kubectl create namespace SafeMask

# Create secrets
kubectl create secret generic SafeMask-secrets \
  --namespace=SafeMask \
  --from-literal=relayer-private-key=$RELAYER_PRIVATE_KEY \
  --from-literal=database-url=$DATABASE_URL \
  --from-literal=redis-url=$REDIS_URL

# Deploy services
kubectl apply -f infra/k8s/deployment.yaml
kubectl apply -f infra/k8s/service.yaml
kubectl apply -f infra/k8s/ingress.yaml

# Check status
kubectl get pods -n SafeMask
kubectl logs -f deployment/bridge-watcher -n SafeMask
```

### 3. Database Setup
```bash
# Create PostgreSQL database
psql -U postgres -c "CREATE DATABASE SafeMask;"

# Run migrations
psql -U postgres -d SafeMask -f infra/db/schema.sql

# Create indexes
psql -U postgres -d SafeMask -f infra/db/indexes.sql
```

### 4. Redis Configuration
```bash
# Connect to Redis
redis-cli

# Set configuration
CONFIG SET maxmemory 2gb
CONFIG SET maxmemory-policy allkeys-lru
CONFIG REWRITE
```

## Mobile App

### 1. Build Rust FFI
```bash
cd crates/ffi

# iOS
cargo build --release --target aarch64-apple-ios
cargo build --release --target x86_64-apple-ios

# Android
cargo build --release --target aarch64-linux-android
cargo build --release --target armv7-linux-androideabi
cargo build --release --target x86_64-linux-android
```

### 2. Build React Native App

#### iOS
```bash
cd ios
pod install
cd ..

# Build for simulator
npx react-native run-ios

# Build for device (requires Apple Developer account)
xcodebuild -workspace ios/SafeMask.xcworkspace \
  -scheme SafeMask \
  -configuration Release \
  -archivePath build/SafeMask.xcarchive \
  archive

# Create IPA
xcodebuild -exportArchive \
  -archivePath build/SafeMask.xcarchive \
  -exportPath build/SafeMask.ipa \
  -exportOptionsPlist exportOptions.plist
```

#### Android
```bash
cd android

# Build APK
./gradlew assembleRelease

# Build AAB (for Play Store)
./gradlew bundleRelease

# Sign release build
jarsigner -verbose -sigalg SHA256withRSA \
  -digestalg SHA-256 \
  -keystore SafeMask.keystore \
  app/build/outputs/bundle/release/app-release.aab \
  SafeMask-key
```

### 3. App Store Submission

#### iOS (App Store Connect)
1. Create app in App Store Connect
2. Upload IPA with Transporter
3. Fill in app metadata
4. Submit for review

#### Android (Google Play Console)
1. Create app in Play Console
2. Upload AAB
3. Complete store listing
4. Submit for review

## Monitoring

### 1. Prometheus Setup
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'bridge-watcher'
    static_configs:
      - targets: ['localhost:8080']
```

### 2. Grafana Dashboards
```bash
# Import dashboards
grafana-cli admin import grafana/bridge-watcher.json
grafana-cli admin import grafana/smart-contracts.json
```

### 3. Alerting
```yaml
# alertmanager.yml
route:
  receiver: 'slack'
  group_by: ['alertname']
  group_wait: 10s
  repeat_interval: 1h

receivers:
  - name: 'slack'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK'
        channel: '#SafeMask-alerts'
```

### 4. Log Aggregation
```bash
# Elasticsearch + Kibana
helm install elasticsearch elastic/elasticsearch
helm install kibana elastic/kibana

# FluentD for log shipping
kubectl apply -f infra/k8s/fluentd.yaml
```

## Security Checklist

### Smart Contracts
- [ ] Contracts audited by reputable firm
- [ ] All tests passing (100% coverage)
- [ ] Ownership transferred to multisig
- [ ] Emergency pause mechanism tested
- [ ] Upgrade proxy configured (if upgradeable)
- [ ] Time locks on critical functions
- [ ] Gas limits tested with high load

### Backend
- [ ] API authentication enabled
- [ ] Rate limiting configured
- [ ] HTTPS/TLS enforced
- [ ] Database encrypted at rest
- [ ] Private keys stored in HSM/KMS
- [ ] DDoS protection enabled
- [ ] CORS configured correctly
- [ ] Input validation on all endpoints

### Mobile App
- [ ] Code obfuscation enabled
- [ ] Root/jailbreak detection
- [ ] SSL pinning implemented
- [ ] Keychain/Keystore encryption
- [ ] No hardcoded secrets
- [ ] Minimum OS versions enforced
- [ ] App transport security configured

### Infrastructure
- [ ] Firewall rules configured
- [ ] VPC/network isolation
- [ ] Secrets rotation policy
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan
- [ ] Incident response plan
- [ ] Access logs enabled
- [ ] MFA for all admin accounts

### Compliance
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] GDPR compliance (if EU users)
- [ ] KYC/AML procedures (if required)
- [ ] Bug bounty program launched
- [ ] Security disclosure policy

## Rollback Procedures

### Smart Contracts
```bash
# Pause contracts
npx hardhat run scripts/pause-contracts.js --network mainnet

# Revert to previous deployment
# (requires proxy pattern)
npx hardhat run scripts/rollback.js --network mainnet
```

### Backend
```bash
# Kubernetes rollback
kubectl rollout undo deployment/bridge-watcher -n SafeMask

# Or roll back to specific revision
kubectl rollout undo deployment/bridge-watcher \
  --to-revision=2 \
  -n SafeMask
```

### Mobile App
- iOS: Submit expedited review with rollback version
- Android: Activate previous release in Play Console

## Production URLs

After deployment, services will be available at:

- **API**: `https://api.SafeMask.io`
- **WebSocket**: `wss://ws.SafeMask.io`
- **Grafana**: `https://grafana.SafeMask.io`
- **Smart Contracts**: See `deployments/mainnet.json`

## Support

- Emergency hotline: +1-XXX-XXX-XXXX
- Email: ops@SafeMask.io
- On-call rotation: PagerDuty
- Status page: https://status.SafeMask.io

## Post-Deployment

### Day 1
- [ ] Monitor error rates
- [ ] Check transaction throughput
- [ ] Verify all integrations
- [ ] Test emergency procedures

### Week 1
- [ ] Review performance metrics
- [ ] Analyze user feedback
- [ ] Optimize gas costs
- [ ] Scale infrastructure if needed

### Month 1
- [ ] Security audit findings addressed
- [ ] Performance optimization
- [ ] Feature usage analysis
- [ ] Cost optimization review
