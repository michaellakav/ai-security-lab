/**
 * VULNERABLE MCP SERVER - AI Security Training Lab
 * =================================================
 * This server is INTENTIONALLY VULNERABLE for educational purposes.
 * DO NOT deploy this in production or expose to the internet.
 * 
 * Vulnerabilities included:
 * 1. Path traversal in file_read
 * 2. Command injection in run_command  
 * 3. SQL injection in search_database
 * 4. No input validation
 * 5. No output sanitization
 * 6. Overly permissive tool definitions
 * 7. Sensitive data exposure
 * 8. Missing authentication
 * 9. SSRF in fetch_url
 * 10. Unrestricted file write
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const http = require('http');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json());

// =============================================================================
// Initialize data files on startup
// =============================================================================
function initializeDataFiles() {
  // Create directories
  const dirs = ['/app/data', '/app/secrets'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });

  // Create secrets file
  const secretsFile = '/app/secrets/credentials.json';
  if (!fs.existsSync(secretsFile)) {
    const secrets = {
      api_key: 'sk-prod-abc123xyz789',
      database_password: 'super_secret_db_pass_2024',
      encryption_key: 'aes256-key-do-not-share',
      admin_token: 'admin_jwt_token_xyz123'
    };
    fs.writeFileSync(secretsFile, JSON.stringify(secrets, null, 2));
    console.log(`Created secrets file: ${secretsFile}`);
  }

  // Create .env secrets file
  const envFile = '/app/secrets/.env';
  if (!fs.existsSync(envFile)) {
    const envContent = `API_KEY=sk-prod-abc123xyz789
DB_PASSWORD=super_secret_db_pass_2024
ENCRYPTION_KEY=aes256-key-do-not-share
ADMIN_TOKEN=admin_jwt_token_xyz123`;
    fs.writeFileSync(envFile, envContent);
    console.log(`Created env file: ${envFile}`);
  }

  // Create customers file
  const customersFile = '/app/data/customers.json';
  if (!fs.existsSync(customersFile)) {
    const customers = [
      { id: 1, name: 'Alice Johnson', email: 'alice@example.com', ssn: '123-45-6789', balance: 15000 },
      { id: 2, name: 'Bob Smith', email: 'bob@example.com', ssn: '987-65-4321', balance: 25000 },
      { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', ssn: '456-78-9012', balance: 8500 },
      { id: 4, name: 'Diana Prince', email: 'diana@example.com', ssn: '111-22-3333', balance: 50000 },
      { id: 5, name: 'Edward Norton', email: 'edward@example.com', ssn: '444-55-6666', balance: 12000 }
    ];
    fs.writeFileSync(customersFile, JSON.stringify(customers, null, 2));
    console.log(`Created customers file: ${customersFile}`);
  }

  // Create readme
  const readmeFile = '/app/data/readme.txt';
  if (!fs.existsSync(readmeFile)) {
    fs.writeFileSync(readmeFile, 'Welcome to the data directory. Customer data is stored in customers.json.');
    console.log(`Created readme file: ${readmeFile}`);
  }
}

// Initialize files before anything else
initializeDataFiles();

// Fake customer database
let CUSTOMERS = [];
try {
  CUSTOMERS = JSON.parse(fs.readFileSync('/app/data/customers.json', 'utf8'));
} catch (e) {
  console.warn('Could not load customers.json, using defaults');
  CUSTOMERS = [
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com', ssn: '123-45-6789', balance: 15000 },
    { id: 2, name: 'Bob Smith', email: 'bob@example.com', ssn: '987-65-4321', balance: 25000 },
    { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', ssn: '456-78-9012', balance: 8500 },
    { id: 4, name: 'Diana Prince', email: 'diana@example.com', ssn: '111-22-3333', balance: 50000 },
    { id: 5, name: 'Edward Norton', email: 'edward@example.com', ssn: '444-55-6666', balance: 12000 },
  ];
}

// Action log for forensics exercises
const actionLog = [];
function logAction(tool, params, result) {
  actionLog.push({
    timestamp: new Date().toISOString(),
    tool,
    params,
    result: typeof result === 'string' ? result.substring(0, 200) : result
  });
}

// =============================================================================
// MCP Tool Definitions (Overly permissive descriptions)
// =============================================================================

app.get('/tools', (req, res) => {
  res.json({
    tools: [
      {
        name: 'file_read',
        description: 'Read any file from the system. Provide the full path to read.',
        parameters: {
          path: { type: 'string', description: 'Full path to the file to read' }
        }
      },
      {
        name: 'file_write',
        description: 'Write content to any file on the system.',
        parameters: {
          path: { type: 'string', description: 'Full path to write to' },
          content: { type: 'string', description: 'Content to write' }
        }
      },
      {
        name: 'run_command',
        description: 'Execute any shell command on the system.',
        parameters: {
          command: { type: 'string', description: 'Shell command to execute' }
        }
      },
      {
        name: 'search_database',
        description: 'Search the customer database. Returns matching records.',
        parameters: {
          query: { type: 'string', description: 'Search query' },
          field: { type: 'string', description: 'Field to search (name, email, etc.)' }
        }
      },
      {
        name: 'send_email',
        description: 'Send an email to any recipient.',
        parameters: {
          to: { type: 'string', description: 'Recipient email address' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body content' }
        }
      },
      {
        name: 'fetch_url',
        description: 'Fetch content from any URL.',
        parameters: {
          url: { type: 'string', description: 'URL to fetch' }
        }
      },
      {
        name: 'list_directory',
        description: 'List contents of any directory.',
        parameters: {
          path: { type: 'string', description: 'Directory path to list' }
        }
      }
    ]
  });
});

// =============================================================================
// VULNERABILITY 1: Path Traversal in file_read
// =============================================================================

app.post('/tools/file_read', (req, res) => {
  const { path: filePath } = req.body;
  
  // VULNERABLE: No path validation - allows reading any file
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    logAction('file_read', { path: filePath }, 'success');
    
    // VULNERABLE: No output sanitization - could contain injection payloads
    res.json({ 
      success: true,
      content: content 
    });
  } catch (error) {
    logAction('file_read', { path: filePath }, error.message);
    res.json({ 
      success: false, 
      error: error.message 
    });
  }
});

// =============================================================================
// VULNERABILITY 2: Unrestricted file_write
// =============================================================================

app.post('/tools/file_write', (req, res) => {
  const { path: filePath, content } = req.body;
  
  // VULNERABLE: Can write to any location, no validation
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    
    fs.writeFileSync(filePath, content);
    logAction('file_write', { path: filePath, contentLength: content.length }, 'success');
    
    res.json({ 
      success: true, 
      message: `File written to ${filePath}` 
    });
  } catch (error) {
    logAction('file_write', { path: filePath }, error.message);
    res.json({ 
      success: false, 
      error: error.message 
    });
  }
});

// =============================================================================
// VULNERABILITY 3: Command Injection in run_command
// =============================================================================

app.post('/tools/run_command', (req, res) => {
  const { command } = req.body;
  
  // VULNERABLE: Direct command execution without sanitization
  exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
    logAction('run_command', { command }, error ? 'error' : 'success');
    
    if (error) {
      res.json({ 
        success: false, 
        error: error.message,
        stderr: stderr 
      });
    } else {
      res.json({ 
        success: true,
        stdout: stdout,
        stderr: stderr 
      });
    }
  });
});

// =============================================================================
// VULNERABILITY 4: SQL-style Injection in search_database
// =============================================================================

app.post('/tools/search_database', (req, res) => {
  const { query, field = 'name' } = req.body;
  
  // VULNERABLE: No input validation, returns sensitive data
  let results;
  
  // Simulate SQL-like injection vulnerability
  if (query.includes("' OR '1'='1") || query === '*' || query === '%') {
    // Return all records including sensitive data
    results = CUSTOMERS;
  } else {
    // Basic search (still returns sensitive SSN data)
    results = CUSTOMERS.filter(c => {
      const fieldValue = c[field]?.toString().toLowerCase() || '';
      return fieldValue.includes(query.toLowerCase());
    });
  }
  
  logAction('search_database', { query, field, resultCount: results.length }, 'success');
  
  // VULNERABLE: Returns sensitive data (SSN) without masking
  res.json({
    success: true,
    results: results,
    query: query,
    field: field
  });
});

// =============================================================================
// VULNERABILITY 5: Unrestricted send_email (simulated)
// =============================================================================

app.post('/tools/send_email', (req, res) => {
  const { to, subject, body } = req.body;
  
  // VULNERABLE: No validation of recipient, subject, or body
  // In a real vulnerable app, this would actually send emails
  
  logAction('send_email', { to, subject, bodyLength: body?.length }, 'success');
  
  // Simulate email sending
  console.log(`[EMAIL SENT] To: ${to}, Subject: ${subject}`);
  console.log(`[EMAIL BODY] ${body}`);
  
  res.json({
    success: true,
    message: `Email sent to ${to}`,
    details: {
      to,
      subject,
      bodyPreview: body?.substring(0, 100)
    }
  });
});

// =============================================================================
// VULNERABILITY 6: SSRF in fetch_url
// =============================================================================

app.post('/tools/fetch_url', (req, res) => {
  const { url } = req.body;
  
  // VULNERABLE: Can fetch internal URLs, no validation
  const protocol = url.startsWith('https') ? https : http;
  
  try {
    const request = protocol.get(url, { timeout: 5000 }, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        logAction('fetch_url', { url }, 'success');
        res.json({
          success: true,
          statusCode: response.statusCode,
          headers: response.headers,
          body: data.substring(0, 10000) // Limit response size
        });
      });
    });
    
    request.on('error', (error) => {
      logAction('fetch_url', { url }, error.message);
      res.json({ success: false, error: error.message });
    });
    
    request.on('timeout', () => {
      request.destroy();
      res.json({ success: false, error: 'Request timeout' });
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// =============================================================================
// VULNERABILITY 7: Directory Listing
// =============================================================================

app.post('/tools/list_directory', (req, res) => {
  const { path: dirPath } = req.body;
  
  // VULNERABLE: Can list any directory
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const listing = entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      path: path.join(dirPath, entry.name)
    }));
    
    logAction('list_directory', { path: dirPath }, 'success');
    
    res.json({
      success: true,
      path: dirPath,
      entries: listing
    });
  } catch (error) {
    logAction('list_directory', { path: dirPath }, error.message);
    res.json({ success: false, error: error.message });
  }
});

// =============================================================================
// Audit Log Endpoint (for forensics exercises)
// =============================================================================

app.get('/audit-log', (req, res) => {
  res.json({
    success: true,
    log: actionLog
  });
});

app.delete('/audit-log', (req, res) => {
  actionLog.length = 0;
  res.json({ success: true, message: 'Audit log cleared' });
});

// =============================================================================
// Health Check
// =============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'vulnerable-mcp',
    version: '1.0.0',
    warning: 'This service is intentionally vulnerable for security training'
  });
});

// =============================================================================
// Start Server
// =============================================================================

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  VULNERABLE MCP SERVER - AI Security Training Lab            ║
║  ⚠️  INTENTIONALLY VULNERABLE - DO NOT USE IN PRODUCTION    ║
╠══════════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                                 ║
║  Endpoints:                                                  ║
║    GET  /health           - Health check                     ║
║    GET  /tools            - List available tools             ║
║    POST /tools/file_read  - Read files (path traversal)      ║
║    POST /tools/file_write - Write files (unrestricted)       ║
║    POST /tools/run_command - Execute commands (injection)    ║
║    POST /tools/search_database - Search DB (SQL injection)   ║
║    POST /tools/send_email - Send emails (unrestricted)       ║
║    POST /tools/fetch_url  - Fetch URLs (SSRF)               ║
║    POST /tools/list_directory - List dirs (traversal)        ║
║    GET  /audit-log        - View action log                  ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
