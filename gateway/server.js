/**
 * MCP GATEWAY - AI Security Training Lab
 * =======================================
 * A gateway that sits between AI clients and MCP servers,
 * enforcing security policies on tool invocations.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
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
  if (policies.logging?.level === 'verbose') {
    console.log('[AUDIT]', JSON.stringify(entry));
  } else {
    console.log('[AUDIT]', entry.event, entry.tool || '');
  }
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
// Path Validation Helpers
// =============================================================================

function isPathAllowed(requestedPath, allowedPaths) {
  if (!allowedPaths || allowedPaths.length === 0) return true;
  
  // Canonicalize the requested path to prevent ../ bypasses
  const canonical = path.resolve(requestedPath);
  
  return allowedPaths.some(allowedPath => {
    // If the allowed path ends with /, treat it as a directory prefix
    if (allowedPath.endsWith('/')) {
      const canonicalAllowed = path.resolve(allowedPath);
      return canonical.startsWith(canonicalAllowed);
    }
    // Otherwise do glob matching
    const regex = new RegExp('^' + allowedPath.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
    return regex.test(canonical);
  });
}

function isPathBlocked(requestedPath, blockedPatterns) {
  if (!blockedPatterns || blockedPatterns.length === 0) return false;
  
  const canonical = path.resolve(requestedPath);
  
  return blockedPatterns.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
    return regex.test(canonical) || regex.test(requestedPath);
  });
}

function hasTraversal(requestedPath) {
  return requestedPath.includes('..') || 
         requestedPath.includes('%2e%2e') || 
         requestedPath.includes('%2E%2E');
}

// =============================================================================
// Command Validation Helpers
// =============================================================================

function hasProhibitedCharacters(command, prohibitedChars) {
  if (!prohibitedChars || prohibitedChars.length === 0) return false;
  return prohibitedChars.some(char => command.includes(char));
}

function isCommandAllowed(command, allowedCommands) {
  if (!allowedCommands || allowedCommands.length === 0) return true;
  
  // Extract the binary path from the command (first token)
  const binary = command.trim().split(/\s+/)[0];
  
  return allowedCommands.some(allowed => {
    return binary === allowed || command.startsWith(allowed);
  });
}

// =============================================================================
// Policy Enforcement
// =============================================================================

function checkToolPolicy(toolName, params) {
  const toolPolicy = policies.tools?.[toolName] || {};
  const globalPolicy = policies.global || {};
  const errors = [];
  
  // Check if tool requires user confirmation
  if (globalPolicy.require_user_confirmation?.includes(toolName)) {
    return {
      allowed: false,
      requiresConfirmation: true,
      message: `Tool '${toolName}' requires user confirmation before execution`
    };
  }
  
  // ---- file_read / file_write / list_directory checks ----
  if (['file_read', 'file_write', 'list_directory'].includes(toolName)) {
    const requestedPath = params.path || '';
    
    // Check for path traversal
    if (toolPolicy.disallow_traversal && hasTraversal(requestedPath)) {
      errors.push(`Path traversal detected in '${requestedPath}' — ".." sequences are blocked`);
    }
    
    // Check allowed paths (directory prefix matching)
    if (toolPolicy.allowed_paths) {
      if (!isPathAllowed(requestedPath, toolPolicy.allowed_paths)) {
        errors.push(`Path '${requestedPath}' is not within allowed paths: ${toolPolicy.allowed_paths.join(', ')}`);
      }
    }
    
    // Check blocked patterns
    if (toolPolicy.blocked_patterns) {
      if (isPathBlocked(requestedPath, toolPolicy.blocked_patterns)) {
        errors.push(`Path '${requestedPath}' matches a blocked pattern`);
      }
    }
  }
  
  // ---- run_command checks ----
  if (toolName === 'run_command') {
    const command = params.command || '';
    
    // Check for prohibited characters (command chaining)
    if (toolPolicy.prohibited_characters) {
      if (hasProhibitedCharacters(command, toolPolicy.prohibited_characters)) {
        const found = toolPolicy.prohibited_characters.filter(c => command.includes(c));
        errors.push(`Command contains prohibited characters: ${found.join(' ')}`);
      }
    }
    
    // Check allowed commands (allowlist)
    if (toolPolicy.allowed_commands) {
      if (!isCommandAllowed(command, toolPolicy.allowed_commands)) {
        errors.push(`Command '${command.split(/\s+/)[0]}' is not in the allowed commands list`);
      }
    }
  }
  
  // ---- send_email checks ----
  if (toolName === 'send_email') {
    const recipient = params.to || '';
    
    // Check allowed recipients
    if (toolPolicy.allowed_recipients) {
      const isAllowed = toolPolicy.allowed_recipients.some(pattern => {
        if (pattern.startsWith('*@')) {
          return recipient.endsWith(pattern.slice(1));
        }
        return recipient === pattern;
      });
      
      if (!isAllowed) {
        errors.push(`Recipient '${recipient}' is not in the allowed recipients list`);
      }
    }
    
    // Check blocked recipients
    if (toolPolicy.blocked_recipients) {
      for (const pattern of toolPolicy.blocked_recipients) {
        if (pattern.startsWith('*@') && recipient.endsWith(pattern.slice(1))) {
          errors.push(`Recipient '${recipient}' matches blocked domain: ${pattern}`);
        } else if (recipient === pattern) {
          errors.push(`Recipient '${recipient}' is explicitly blocked`);
        }
      }
    }
  }
  
  // ---- fetch_url checks ----
  if (toolName === 'fetch_url') {
    const url = params.url || '';
    
    if (toolPolicy.blocked_domains) {
      for (const domain of toolPolicy.blocked_domains) {
        if (url.includes(domain)) {
          errors.push(`URL contains blocked domain: ${domain}`);
        }
      }
    }
    
    if (toolPolicy.allowed_schemes) {
      const scheme = url.split('://')[0];
      if (!toolPolicy.allowed_schemes.includes(scheme)) {
        errors.push(`URL scheme '${scheme}' is not allowed. Allowed: ${toolPolicy.allowed_schemes.join(', ')}`);
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
    params: policies.logging?.include_payloads ? params : '[redacted]',
    targetServer
  });
  
  // Check policy
  const policyResult = checkToolPolicy(tool, params);
  
  if (!policyResult.allowed) {
    log({
      event: 'policy_blocked',
      tool,
      params: policies.logging?.include_payloads ? params : '[redacted]',
      reason: policyResult.errors || policyResult.message
    });
    
    return res.status(403).json({
      success: false,
      blocked: true,
      requiresConfirmation: policyResult.requiresConfirmation || false,
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
    entries: auditLog.slice(-100)
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

// Reload policies from disk (useful after editing policies.yaml)
app.post('/policies/reload', (req, res) => {
  try {
    const policyFile = fs.readFileSync('/app/policies.yaml', 'utf8');
    policies = yaml.load(policyFile);
    log({ event: 'policies_reloaded' });
    res.json({ success: true, message: 'Policies reloaded', policies });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'mcp-gateway',
    version: '2.0.0'
  });
});

// =============================================================================
// Start Server
// =============================================================================

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  MCP GATEWAY v2.0 - AI Security Training Lab                 ║
║  Policy enforcement enabled                                  ║
╠══════════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                                 ║
║                                                              ║
║  Endpoints:                                                  ║
║    POST /invoke           - Invoke tool through gateway      ║
║    GET  /policies         - View current policies            ║
║    POST /policies/reload  - Reload policies from disk        ║
║    GET  /audit-log        - View audit log                   ║
║    GET  /health           - Health check                     ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
