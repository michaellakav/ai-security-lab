FROM python:3.11-slim

WORKDIR /app

# Install curl for Ollama health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Make startup script executable
RUN chmod +x /app/start.sh

EXPOSE 5000

CMD ["/app/start.sh"]
