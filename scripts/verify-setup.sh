#!/bin/bash

# AI Security Lab - Setup Verification Script
# This script checks that all lab components are running correctly

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  AI Security Lab - Setup Verification"
echo "========================================"
echo ""

check_service() {
    local name=$1
    local url=$2
    local expected=$3
    
    printf "Checking %-25s" "$name..."
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$response" = "$expected" ]; then
        echo -e " ${GREEN}✓ OK${NC} (HTTP $response)"
        return 0
    else
        echo -e " ${RED}✗ FAILED${NC} (HTTP $response, expected $expected)"
        return 1
    fi
}

echo "Checking services..."
echo ""

failed=0

check_service "Vulnerable Chatbot" "http://localhost:5050/health" "200" || ((failed++))
check_service "Vulnerable MCP Server" "http://localhost:3001/health" "200" || ((failed++))
check_service "Secure MCP Server" "http://localhost:3002/health" "200" || ((failed++))
check_service "MCP Gateway" "http://localhost:8080/health" "200" || ((failed++))
check_service "Attacker Site" "http://localhost:9090/" "200" || ((failed++))
check_service "Ollama LLM" "http://localhost:11434/api/tags" "200" || ((failed++))

echo ""
echo "========================================"

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}All services are running!${NC}"
    echo ""
    echo "You can now access:"
    echo "  - Chatbot:       http://localhost:5050"
    echo "  - Attacker Site: http://localhost:9090"
    echo "  - MCP Gateway:   http://localhost:8080"
    echo ""
    echo "Happy hacking! 🎯"
else
    echo -e "${RED}$failed service(s) failed to start${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Run 'docker-compose logs <service>' to see errors"
    echo "  2. Ensure Docker has enough resources allocated"
    echo "  3. Check if ports are already in use"
    echo ""
    echo "If Ollama is slow, it may still be downloading the model."
    echo "Run 'docker-compose logs ollama' to check progress."
fi

echo "========================================"
