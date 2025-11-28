#!/bin/bash

# SafeMask Deployment Script
# Automates deployment to Kubernetes cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging}
NAMESPACE="SafeMask-${ENVIRONMENT}"
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"your-registry"}
IMAGE_TAG=${2:-latest}

echo -e "${GREEN}=== SafeMask Deployment ===${NC}"
echo -e "Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "Namespace: ${YELLOW}${NAMESPACE}${NC}"
echo -e "Image Tag: ${YELLOW}${IMAGE_TAG}${NC}"
echo ""

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi

# Create namespace if it doesn't exist
echo -e "${GREEN}Creating namespace...${NC}"
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Apply ConfigMaps and Secrets
echo -e "${GREEN}Applying configuration...${NC}"
kubectl apply -f infra/k8s/${ENVIRONMENT}/

# Update image tags in deployments
echo -e "${GREEN}Updating image tags...${NC}"
kubectl set image deployment/SafeMask-bridge-watcher \
    bridge-watcher=${DOCKER_REGISTRY}/SafeMask-bridge-watcher:${IMAGE_TAG} \
    -n ${NAMESPACE}

kubectl set image deployment/SafeMask-mesh-node \
    mesh-node=${DOCKER_REGISTRY}/SafeMask-mesh-node:${IMAGE_TAG} \
    -n ${NAMESPACE}

# Wait for rollout to complete
echo -e "${GREEN}Waiting for rollout to complete...${NC}"
kubectl rollout status deployment/SafeMask-bridge-watcher -n ${NAMESPACE} --timeout=5m
kubectl rollout status deployment/SafeMask-mesh-node -n ${NAMESPACE} --timeout=5m

# Verify deployment
echo -e "${GREEN}Verifying deployment...${NC}"
kubectl get pods -n ${NAMESPACE}
kubectl get services -n ${NAMESPACE}

# Get service URLs
BRIDGE_WATCHER_IP=$(kubectl get service bridge-watcher-service -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
MESH_NODE_IP=$(kubectl get service mesh-node-service -n ${NAMESPACE} -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo -e ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo -e "Bridge Watcher: ${YELLOW}http://${BRIDGE_WATCHER_IP}${NC}"
echo -e "Mesh Node: ${YELLOW}tcp://${MESH_NODE_IP}:8333${NC}"
echo -e "Metrics: ${YELLOW}http://${MESH_NODE_IP}:9090${NC}"
echo -e ""
echo -e "${GREEN}Run health checks:${NC}"
echo -e "  curl http://${BRIDGE_WATCHER_IP}/health"
echo -e "  curl http://${MESH_NODE_IP}:9090/health"
