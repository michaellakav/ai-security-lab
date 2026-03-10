#!/bin/bash
# Startup script for the vulnerable chatbot
# Waits for Ollama to be ready and have the model pulled before starting Flask

OLLAMA_HOST="${OLLAMA_HOST:-http://ollama:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5:1.5b}"
LLM_PROVIDER="${LLM_PROVIDER:-ollama}"
MAX_RETRIES=60
RETRY_INTERVAL=5

# Only wait for Ollama if we're using it (not OpenAI/Anthropic)
if [ "$LLM_PROVIDER" = "ollama" ]; then
    echo "[startup] Waiting for Ollama to be ready at $OLLAMA_HOST..."

    # Step 1: Wait for Ollama server to respond
    retries=0
    until curl -sf "$OLLAMA_HOST/api/version" > /dev/null 2>&1; do
        retries=$((retries + 1))
        if [ $retries -ge $MAX_RETRIES ]; then
            echo "[startup] ERROR: Ollama not available after $((MAX_RETRIES * RETRY_INTERVAL))s. Starting anyway..."
            break
        fi
        echo "[startup] Ollama not ready yet (attempt $retries/$MAX_RETRIES)..."
        sleep $RETRY_INTERVAL
    done

    if curl -sf "$OLLAMA_HOST/api/version" > /dev/null 2>&1; then
        echo "[startup] Ollama server is up."

        # Step 2: Wait for the model to be available
        retries=0
        until curl -sf "$OLLAMA_HOST/api/show" -d "{\"name\":\"$OLLAMA_MODEL\"}" > /dev/null 2>&1; do
            retries=$((retries + 1))
            if [ $retries -ge $MAX_RETRIES ]; then
                echo "[startup] ERROR: Model '$OLLAMA_MODEL' not available after $((MAX_RETRIES * RETRY_INTERVAL))s. Starting anyway..."
                break
            fi
            echo "[startup] Model '$OLLAMA_MODEL' not ready yet - still downloading? (attempt $retries/$MAX_RETRIES)..."
            sleep $RETRY_INTERVAL
        done

        if curl -sf "$OLLAMA_HOST/api/show" -d "{\"name\":\"$OLLAMA_MODEL\"}" > /dev/null 2>&1; then
            echo "[startup] Model '$OLLAMA_MODEL' is ready!"
        fi
    fi
else
    echo "[startup] Using $LLM_PROVIDER provider, skipping Ollama wait."
fi

echo "[startup] Starting Flask application..."
exec python app.py
