/**
 * SECURE MCP SERVER - AI Security Training Lab
 * =============================================
 * This is a SKELETON for participants to implement secure versions
 * of the vulnerable MCP tools.
 * 
 * EXERCISE: Implement security controls for each tool endpoint.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// =============================================================================
// Security Configuration - IMPLEMENT THESE
// =============================================================================

const ALLOWED_DIRECTORIES = [
  '/app/data'
  // TODO: Add more allowed directories as needed
];

const BLOCKED_FILE_PATTERNS = [
  /\.env$/i,
  /credentials/i,
  /secret/i,
  /password/i,
  /\.key$/i,
  /\.pem$/i
];

const ALLOWED_EMAIL_DOMAINS = [
  'company.com',
  'techcorp.com'
  // TODO: Add allowed recipient domains
];

// Patterns that indicate prompt injection attempts in outputs
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /you\s+are\s+now/gi,
  /system\s*prompt/gi,
  /forget\s+(everything|all)/gi,
  /pretend\s+(you('re|are)|to\s+be)/gi,
  /new\s+(role|instructions)/gi,
  // TODO: Add more patterns
];

// =============================================================================
// Security Helpers - IMPLEMENT THESE
// =============================================================================

/**
 * Validate that a file path is within allowed directories
 * TODO: Implement path traversal prevention
 */
function validateFilePath(inputPath) {
  const resolved = path.resolve(inputPath);
  
  // Check if path is within allowed directories
  const isAllowed = ALLOWED_DIRECTORIES.some(dir => 
    resolved.startsWith(path.resolve(dir))
  );
  
  if (!isAllowed) {
    throw new Error('Access denied: path outside allowed directories');
  }
  
  // Check for blocked patterns
  for (const pattern of BLOCKED_FILE_PATTERNS) {
    if (pattern.test(resolved)) {
      throw new Error('Access denied: file type not allowed');
    }
  }
  
  return resolved;
}

/**
 * Sanitize output to remove potential injection payloads
 * TODO: Implement comprehensive output sanitization
 */
function sanitizeOutput(content) {
  let sanitized = content;
  let findings = [];
  
  for (const pattern of INJECTION_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      findings.push({
        pattern: pattern.toString(),
        matches: matches
      });
      // Replace with safe placeholder
      sanitized = sanitized.replace(pattern, '[FILTERED]');
    }
  }
  
  return {
    content: sanitized,
    wasModified: findings.length > 0,
    findings: findings
  };
}

/**
 * Validate email recipient
 * TODO: Implement email validation
 */
function validateEmailRecipient(email) {
  const domain = email.split('@')[1];
  if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    throw new Error(`Email domain not allowed: ${domain}`);
  }
  return true;
}

/**
 * Mask sensitive data in database results
 * TODO: Implement data masking
 */
function maskSensitiveData(records) {
  return records.map(record => ({
    ...record,
    ssn: record.ssn ? '***-**-' + record.ssn.slice(-4) : undefined,
    // TODO: Add more field masking
  }));
}

// =============================================================================
// Secure Tool Endpoints - IMPLEMENT THESE
// =============================================================================

// Tool definitions with restricted descriptions
app.get('/tools', (req, res) => {
  res.json({
    tools: [
      {
        name: 'file_read',
        description: 'Read files from the data directory only.',
        parameters: {
          path: { type: 'string', description: 'Relative path within /app/data' }
        }
      },
      {
        name: 'search_database',
        description: 'Search customer database. SSN and sensitive fields are masked.',
        parameters: {
          query: { type: 'string', description: 'Search query' },
          field: { type: 'string', description: 'Field to search (name, email)' }
        }
      },
      {
        name: 'send_email',
        description: 'Send email to approved company domains only. Requires confirmation.',
        parameters: {
          to: { type: 'string', description: 'Recipient (must be @company.com)' },
          subject: { type: 'string', description: 'Email subject' },
          body: { type: 'string', description: 'Email body' }
        }
      }
    ]
  });
});

// Secure file_read with path validation
app.post('/tools/file_read', (req, res) => {
  try {
    const { path: filePath } = req.body;
    
    // Validate path
    const safePath = validateFilePath(filePath);
    
    // Read file
    const content = fs.readFileSync(safePath, 'utf8');
    
    // Sanitize output
    const sanitized = sanitizeOutput(content);
    
    res.json({
      success: true,
      content: sanitized.content,
      warning: sanitized.wasModified ? 'Content was sanitized' : undefined
    });
  } catch (error) {
    res.status(403).json({
      success: false,
      error: error.message
    });
  }
});

// Secure search_database with data masking
app.post('/tools/search_database', (req, res) => {
  try {
    const { query, field = 'name' } = req.body;
    
    // TODO: Implement proper database search
    // For now, return empty results
    const results = [];
    
    // Mask sensitive data
    const maskedResults = maskSensitiveData(results);
    
    res.json({
      success: true,
      results: maskedResults,
      totalCount: maskedResults.length
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Secure send_email with domain validation
app.post('/tools/send_email', (req, res) => {
  try {
    const { to, subject, body } = req.body;
    
    // Validate recipient
    validateEmailRecipient(to);
    
    // In a real implementation, this would require user confirmation
    res.json({
      success: true,
      requiresConfirmation: true,
      message: `Email to ${to} requires user confirmation before sending`,
      preview: {
        to,
        subject,
        bodyPreview: body?.substring(0, 100)
      }
    });
  } catch (error) {
    res.status(403).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'secure-mcp',
    version: '1.0.0'
  });
});

// =============================================================================
// Start Server
// =============================================================================

const PORT = process.env.PORT || 3002;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  SECURE MCP SERVER - AI Security Training Lab                ║
║  🔒 Security controls enabled                                ║
╠══════════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                                 ║
║                                                              ║
║  EXERCISE: Implement additional security controls            ║
║  - Add more path validation                                  ║
║  - Implement rate limiting                                   ║
║  - Add authentication                                        ║
║  - Enhance output sanitization                               ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
