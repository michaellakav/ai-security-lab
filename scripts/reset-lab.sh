#!/bin/bash

# AI Security Lab - Reset Script
# Resets the lab to its initial state

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================"
echo "  AI Security Lab - Reset"
echo "========================================"
echo ""

read -p "This will reset all lab data. Continue? (y/N) " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo -e "${YELLOW}Stopping services...${NC}"
docker-compose down

echo -e "${YELLOW}Removing volumes...${NC}"
docker-compose down -v

echo -e "${YELLOW}Rebuilding containers...${NC}"
docker-compose build --no-cache

echo -e "${YELLOW}Starting services...${NC}"
docker-compose up -d

echo ""
echo -e "${GREEN}Lab has been reset!${NC}"
echo ""
echo "Waiting for services to start..."
sleep 10

./scripts/verify-setup.sh
