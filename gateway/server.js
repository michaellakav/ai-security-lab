/**
 * MCP GATEWAY - AI Security Training Lab
 * =======================================
 * A gateway that sits between AI clients and MCP servers,
 * enforcing security policies on tool invocations.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const yaml = require('js-yaml');

const app = express();
app.use(cors());
app.use(express.json());

// Load policies from YAML file
let policies = {};
try {
  const policyFile = fs.readFileSync('/app/policies.yaml', 'utf8');
  policies = yaml.load(policyFile);
  console.log('Loaded policies:', JSON.stringify(policies, null, 2));
} catch (e) {
  console.warn('Could not load policies.yaml, using defaults');
  policies = {
    global: {
      require_user_confirmation: ['send_email', 'file_write', 'run_command'],
      rate_limits: { default: 100 }
    },
    tools: {},
    content_filtering: {
      instruction_patterns: [
        'ignore previous instructions',
        'you are now',
        'system prompt',
        'disregard'
      ],
      on_detection: 'flag_and_sanitize'
    }
  };
}

// Audit log
const auditLog = [];

function log(event) {
  const entry = {
    timestamp: new Date().toISOString(),
    ...event
  };
  auditLog.push(entry);
  console.log('[AUDIT]', JSON.stringify(entry));
}

// =============================================================================
// Content Filtering
// =============================================================================

function checkForInjection(content) {
  const patterns = policies.content_filtering?.instruction_patterns || [];
  const findings = [];
  
  const contentLower = content.toLowerCase();
  for (const pattern of patterns) {
    if (contentLower.includes(pattern.toLowerCase())) {
      findings.push({
        pattern: pattern,
        severity: 'high'
      });
    }
  }
  
  return findings;
}

function sanitizeContent(content) {
  let sanitized = content;
  const patterns = policies.content_filtering?.instruction_patterns || [];
  
  for (const pattern of patterns) {
    const regex = new RegExp(pattern, 'gi');
    sanitized = sanitized.replace(regex, '[REDACTED]');
  }
  
  return sanitized;
}

// =============================================================================
// Policy Enforcement
// =============================================================================

function checkToolPolicy(toolName, params) {
  const toolPolicy = policies.tools?.[toolName] || {};
  const globalPolicy = policies.global || {};
  const errors = [];
  
  // Check if tool requires confirmation
  if (globalPolicy.require_user_confirmation?.includes(toolName)) {
    return {
      allowed: false,
      requiresConfirmation: true,
      message: `Tool '${toolName}' requires user confirmation`
    };
  }
  
  // Tool-specific checks
  if (toolName === 'file_read' && toolPolicy.allowed_paths) {
    const requestedPath = params.path || '';
    const isAllowed = toolPolicy.allowed_paths.some(pattern => {
      // Simple glob matching
      const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
      return regex.test(requestedPath);
    });
    
    if (!isAllowed) {
      errors.push(`Path '${requestedPath}' not in allowed paths`);
    }
    
    // Check blocked patterns
    if (toolPolicy.blocked_patterns) {
      for (const pattern of toolPolicy.blocked_patterns) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
        if (regex.test(requestedPath)) {
          errors.push(`Path matches blocked pattern: ${pattern}`);
        }
      }
    }
  }
  
  if (toolName === 'send_email' && toolPolicy.allowed_recipients) {
    const recipient = params.to || '';
    const isAllowed = toolPolicy.allowed_recipients.some(pattern => {
      if (pattern.startsWith('*@')) {
        return recipient.endsWith(pattern.slice(1));
      }
      return recipient === pattern;
    });
    
    if (!isAllowed) {
      errors.push(`Recipient '${recipient}' not in allowed list`);
    }
    
    // Check blocked recipients
    if (toolPolicy.blocked_recipients) {
      for (const pattern of toolPolicy.blocked_recipients) {
        if (pattern.startsWith('*@') && recipient.endsWith(pattern.slice(1))) {
          errors.push(`Recipient matches blocked domain: ${pattern}`);
        }
      }
    }
  }
  
  if (errors.length > 0) {
    return {
      allowed: false,
      errors: errors
    };
  }
  
  return { allowed: true };
}

// =============================================================================
// Gateway Endpoints
// =============================================================================

// Proxy tool invocation through the gateway
app.post('/invoke', async (req, res) => {
  const { tool, params, targetServer = 'vulnerable' } = req.body;
  
  log({
    event: 'tool_invocation_request',
    tool,
    params,
    targetServer
  });
  
  // Check policy
  const policyResult = checkToolPolicy(tool, params);
  
  if (!policyResult.allowed) {
    log({
      event: 'policy_blocked',
      tool,
      reason: policyResult.errors || policyResult.message
    });
    
    return res.status(403).json({
      success: false,
      blocked: true,
      requiresConfirmation: policyResult.requiresConfirmation,
      reason: policyResult.errors || [policyResult.message]
    });
  }
  
  // Forward to appropriate MCP server
  const targetUrl = targetServer === 'secure' 
    ? process.env.SECURE_MCP_URL || 'http://secure-mcp:3002'
    : process.env.VULNERABLE_MCP_URL || 'http://vulnerable-mcp:3001';
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${targetUrl}/tools/${tool}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    const result = await response.json();
    
    // Check response for injection attempts
    const resultStr = JSON.stringify(result);
    const injectionFindings = checkForInjection(resultStr);
    
    if (injectionFindings.length > 0) {
      log({
        event: 'injection_detected_in_response',
        tool,
        findings: injectionFindings
      });
      
      if (policies.content_filtering?.on_detection === 'flag_and_sanitize') {
        // Sanitize the response
        const sanitizedResult = JSON.parse(sanitizeContent(resultStr));
        return res.json({
          ...sanitizedResult,
          _gateway_warning: 'Content was sanitized due to potential injection',
          _injection_findings: injectionFindings
        });
      }
    }
    
    log({
      event: 'tool_invocation_success',
      tool
    });
    
    res.json(result);
    
  } catch (error) {
    log({
      event: 'tool_invocation_error',
      tool,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get audit log
app.get('/audit-log', (req, res) => {
  res.json({
    success: true,
    entries: auditLog.slice(-100) // Last 100 entries
  });
});

// Clear audit log
app.delete('/audit-log', (req, res) => {
  auditLog.length = 0;
  res.json({ success: true, message: 'Audit log cleared' });
});

// Get current policies
app.get('/policies', (req, res) => {
  res.json(policies);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'mcp-gateway',
    version: '1.0.0'
  });
});

// =============================================================================
// Start Server
// =============================================================================

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  MCP GATEWAY - AI Security Training Lab                      ║
║  🛡️  Policy enforcement enabled                              ║
╠══════════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                                 ║
║                                                              ║
║  Endpoints:                                                  ║
║    POST /invoke      - Invoke tool through gateway           ║
║    GET  /policies    - View current policies                 ║
║    GET  /audit-log   - View audit log                        ║
║    GET  /health      - Health check                          ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
