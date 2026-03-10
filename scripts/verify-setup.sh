#!/bin/bash

# AI Security Lab - Setup Verification Script
# This script checks that all lab components are running correctly
# The chatbot may take a few minutes on first run while Ollama downloads the model

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
    local max_retries=${4:-1}
    local retry_interval=5
    
    printf "Checking %-30s" "$name..."
    
    local attempt=1
    while [ $attempt -le $max_retries ]; do
        response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
        
        if [ "$response" = "$expected" ]; then
            echo -e " ${GREEN}✓ OK${NC} (HTTP $response)"
            return 0
        fi
        
        if [ $max_retries -gt 1 ] && [ $attempt -lt $max_retries ]; then
            printf "\r  %-30s ${YELLOW}waiting...${NC} (attempt %d/%d)    " "$name" "$attempt" "$max_retries"
            sleep $retry_interval
        fi
        
        ((attempt++))
    done
    
    printf "\rChecking %-30s" "$name..."
    echo -e " ${RED}✗ FAILED${NC} (HTTP $response, expected $expected)"
    return 1
}

echo "Checking services..."
echo ""
echo -e "${YELLOW}NOTE: On first run, the chatbot waits for Ollama to download the${NC}"
echo -e "${YELLOW}model (~640MB). This may take a few minutes. Script retries automatically.${NC}"
echo ""

failed=0

# Services that start quickly - single check
check_service "Ollama LLM" "http://localhost:11434/api/tags" "200" || ((failed++))
check_service "Vulnerable MCP Server" "http://localhost:3001/health" "200" || ((failed++))
check_service "Secure MCP Server" "http://localhost:3002/health" "200" || ((failed++))
check_service "MCP Gateway" "http://localhost:8080/health" "200" || ((failed++))
check_service "Attacker Site" "http://localhost:9090/" "200" || ((failed++))
check_service "Review Site" "http://localhost:9091/health" "200" || ((failed++))
check_service "RAG Service" "http://localhost:9092/health" "200" || ((failed++))
check_service "Attacker Dashboard" "http://localhost:6060/health" "200" || ((failed++))

# Chatbot starts last (waits for Ollama model download) - retry up to 60 times (5 min)
check_service "Vulnerable Chatbot" "http://localhost:5050/health" "200" 60 || ((failed++))

echo ""
echo "========================================"

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}All services are running!${NC}"
    echo ""
    echo "You can now access:"
    echo "  - Chatbot:             http://localhost:5050"
    echo "  - Attacker Site:       http://localhost:9090"
    echo "  - MCP Gateway:         http://localhost:8080"
    echo "  - Review Site:         http://localhost:9091"
    echo "  - RAG Service:         http://localhost:9092"
    echo "  - Attacker Dashboard:  http://localhost:6060"
    echo ""
    echo "Happy hacking!"
else
    echo -e "${RED}$failed service(s) failed to start${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Run 'docker-compose logs <service>' to see errors"
    echo "  2. Ensure Docker has enough resources allocated (8GB+ RAM)"
    echo "  3. Check if ports are already in use"
    echo ""
    echo "If the chatbot failed, Ollama may still be downloading the model."
    echo "Check progress: docker-compose logs ollama"
    echo "Once the model is ready, the chatbot will start automatically."
fi

echo "========================================"
