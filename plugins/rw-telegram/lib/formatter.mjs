/**
 * Message Formatter for Telegram Notifications
 *
 * Formats Claude Code events into readable Telegram messages.
 * Supports both verbose mode (all events) and summary mode (important only).
 */

// Tool type to emoji mapping
const TOOL_EMOJIS = {
  Bash: '🔨',
  Edit: '📝',
  Write: '✍️',
  Read: '📖',
  Glob: '🔍',
  Grep: '🔎',
  Task: '🤖',
  TaskOutput: '📤',
  WebFetch: '🌐',
  WebSearch: '🔍',
  TodoWrite: '📋',
  AskUserQuestion: '❓',
  NotebookEdit: '📓',
  default: '⚙️'
};

// Status emojis
const STATUS_EMOJIS = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  working: '🔄',
  done: '🎉',
  question: '❓',
  stop: '✅',
  end: '🏁',
  plan_ready: '📋',
  review: '🔍',
  limit: '⏱️',
  feature_complete: '🎯',
  tests_passed: '✅',
  tests_failed: '❌'
};

/**
 * Get emoji for a tool type
 */
export function getToolEmoji(toolName) {
  return TOOL_EMOJIS[toolName] || TOOL_EMOJIS.default;
}

/**
 * Get emoji for a status
 */
export function getStatusEmoji(status) {
  return STATUS_EMOJIS[status] || '🤖';
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text, maxLength = 100) {
  if (!text) return '';
  const str = String(text).trim();
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Clean summary text - remove JSON, clean up formatting
 */
function cleanSummaryText(text) {
  if (!text) return null;

  let cleaned = String(text).trim();

  // Try to extract summary from JSON if present
  try {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.summary) {
        cleaned = parsed.summary;
      } else if (parsed.message) {
        cleaned = parsed.message;
      } else if (parsed.details) {
        cleaned = parsed.details;
      }
    }
  } catch {
    // Not JSON, continue with raw text
  }

  // Remove common noise patterns
  cleaned = cleaned
    .replace(/\{"category":\s*"[^"]+",?\s*"summary":\s*"/g, '')
    .replace(/"\s*\}$/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

  // If still looks like JSON, return null
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    return null;
  }

  return cleaned || null;
}

/**
 * Extract command from Bash tool input
 */
function extractBashCommand(input) {
  if (!input) return null;

  // Try to parse as JSON
  try {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
    return parsed.command || parsed.cmd || null;
  } catch {
    // If not JSON, might be raw command
    return typeof input === 'string' ? input : null;
  }
}

/**
 * Extract file path from tool input
 */
function extractFilePath(input) {
  if (!input) return null;

  try {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
    return parsed.file_path || parsed.path || parsed.file || null;
  } catch {
    return null;
  }
}

/**
 * Format Bash tool result
 */
function formatBashResult(result, maxLength = 150) {
  if (!result) return 'completed';

  const str = String(result).trim();

  // Check for common patterns
  if (str.includes('PASSED') || str.includes('passed')) {
    const match = str.match(/(\d+)\s*(tests?\s*)?pass(ed)?/i);
    if (match) return `✅ ${match[1]} tests passed`;
  }

  if (str.includes('FAILED') || str.includes('failed')) {
    const match = str.match(/(\d+)\s*(tests?\s*)?fail(ed)?/i);
    if (match) return `❌ ${match[1]} tests failed`;
  }

  if (str.includes('error') || str.includes('Error')) {
    return '❌ Error occurred';
  }

  if (str.includes('Successfully') || str.includes('successfully')) {
    return '✅ Success';
  }

  // Return truncated output
  return truncateText(str.replace(/\n/g, ' '), maxLength);
}

/**
 * Format a tool use event for verbose mode
 */
export function formatToolEvent(toolName, input, result) {
  const emoji = getToolEmoji(toolName);
  let message = `${emoji} *${toolName}*`;

  switch (toolName) {
    case 'Bash': {
      const cmd = extractBashCommand(input);
      if (cmd) {
        message += `\n\`${truncateText(cmd, 60)}\``;
      }
      if (result) {
        message += `\n→ ${formatBashResult(result)}`;
      }
      break;
    }

    case 'Edit':
    case 'Write':
    case 'Read': {
      const filePath = extractFilePath(input);
      if (filePath) {
        // Show only filename, not full path
        const fileName = filePath.split('/').pop();
        message += `: \`${fileName}\``;
      }
      if (toolName === 'Read' && result) {
        const lines = String(result).split('\n').length;
        message += ` (${lines} lines)`;
      }
      break;
    }

    case 'Task': {
      try {
        const parsed = typeof input === 'string' ? JSON.parse(input) : input;
        const agentType = parsed.subagent_type || 'agent';
        const desc = parsed.description || '';
        message += `\n🤖 Agent: \`${agentType}\``;
        if (desc) {
          message += `\n📝 ${truncateText(desc, 80)}`;
        }
      } catch {
        // Ignore parse errors
      }
      break;
    }

    case 'Glob':
    case 'Grep': {
      try {
        const parsed = typeof input === 'string' ? JSON.parse(input) : input;
        const pattern = parsed.pattern || '';
        if (pattern) {
          message += `: \`${truncateText(pattern, 40)}\``;
        }
      } catch {
        // Ignore
      }
      break;
    }

    case 'AskUserQuestion': {
      message = `❓ *Claude needs input*`;
      try {
        const parsed = typeof input === 'string' ? JSON.parse(input) : input;
        if (parsed.questions && parsed.questions[0]) {
          message += `\n${truncateText(parsed.questions[0].question, 100)}`;
        }
      } catch {
        // Ignore
      }
      break;
    }

    default:
      // Generic format
      break;
  }

  return message;
}

/**
 * Format a summary event (for summary mode)
 */
export function formatSummaryEvent(eventType, data = {}) {
  const project = data.project || 'Claude Code';
  const timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

  // Clean the summary text
  const cleanedSummary = cleanSummaryText(data.summary);

  // Build message parts
  const parts = [];

  switch (eventType) {
    case 'stop':
    case 'done':
      parts.push(`✅ *${project}*`);
      parts.push('');
      parts.push('*Task Complete*');
      if (cleanedSummary) {
        parts.push('');
        parts.push(`📝 ${cleanedSummary}`);
      }
      break;

    case 'feature_complete':
      parts.push(`🎯 *${project}*`);
      parts.push('');
      parts.push(`*Feature Complete*: ${data.featureId || ''}`);
      if (data.filesChanged) {
        parts.push(`📁 ${data.filesChanged} files changed`);
      }
      if (data.testsResult) {
        parts.push(data.testsResult);
      }
      if (cleanedSummary) {
        parts.push('');
        parts.push(`📝 ${cleanedSummary}`);
      }
      break;

    case 'error':
      parts.push(`❌ *${project}*`);
      parts.push('');
      parts.push('*Error Occurred*');
      if (data.error) {
        const cleanError = cleanSummaryText(data.error) || truncateText(data.error, 200);
        parts.push('');
        parts.push(`⚠️ ${cleanError}`);
      }
      break;

    case 'question':
      parts.push(`❓ *${project}*`);
      parts.push('');
      parts.push('*Question from Claude*');
      if (data.question) {
        parts.push('');
        parts.push(data.question);
      }
      break;

    case 'plan_ready':
      parts.push(`📋 *${project}*`);
      parts.push('');
      parts.push('*Plan Ready*');
      parts.push('');
      parts.push('Claude has a plan ready for your approval');
      break;

    case 'review':
      parts.push(`🔍 *${project}*`);
      parts.push('');
      parts.push('*Review Complete*');
      if (cleanedSummary) {
        parts.push('');
        parts.push(`📝 ${cleanedSummary}`);
      }
      break;

    case 'limit':
      parts.push(`⏱️ *${project}*`);
      parts.push('');
      parts.push('*Context Limit Reached*');
      parts.push('');
      parts.push('Session needs to be compacted or restarted');
      break;

    case 'end':
      parts.push(`🏁 *${project}*`);
      parts.push('');
      parts.push('*Session Ended*');
      if (cleanedSummary) {
        parts.push('');
        parts.push(`📝 ${cleanedSummary}`);
      }
      break;

    case 'tests_passed':
      parts.push(`✅ *${project}*`);
      parts.push('');
      parts.push('*All Tests Passed*');
      if (data.count) {
        parts.push(`🧪 ${data.count} tests`);
      }
      break;

    case 'tests_failed':
      parts.push(`❌ *${project}*`);
      parts.push('');
      parts.push('*Tests Failed*');
      if (data.count) {
        parts.push(`🧪 ${data.count} failed`);
      }
      if (cleanedSummary) {
        parts.push('');
        parts.push(`⚠️ ${cleanedSummary}`);
      }
      break;

    default:
      parts.push(`ℹ️ *${project}*`);
      if (cleanedSummary) {
        parts.push('');
        parts.push(cleanedSummary);
      }
  }

  // Add location
  if (data.cwd) {
    // Show only last 2 parts of path
    const cwdParts = data.cwd.split('/');
    const shortPath = cwdParts.slice(-2).join('/');
    parts.push('');
    parts.push(`📂 ${shortPath}`);
  }

  // Add timestamp
  parts.push('');
  parts.push(`_${timestamp}_`);

  return parts.join('\n');
}

/**
 * Check if an event should be sent in summary mode
 */
export function isSummaryEvent(eventType) {
  const summaryEvents = [
    'stop',
    'done',
    'error',
    'question',
    'plan_ready',
    'review',
    'limit',
    'end',
    'feature_complete',
    'tests_passed',
    'tests_failed'
  ];

  return summaryEvents.includes(eventType);
}

/**
 * Format notification based on mode
 */
export function formatNotificationMessage(eventType, data = {}, verboseMode = false) {
  // Tool events are only sent in verbose mode
  if (eventType === 'tool') {
    if (!verboseMode) {
      return null; // Skip in summary mode
    }
    if (data.toolName) {
      return formatToolEvent(data.toolName, data.input, data.result);
    }
    return null;
  }

  // In verbose mode, format all events
  if (verboseMode) {
    if (data.toolName) {
      return formatToolEvent(data.toolName, data.input, data.result);
    }
    return formatSummaryEvent(eventType, data);
  }

  // In summary mode, only format important events
  if (isSummaryEvent(eventType)) {
    return formatSummaryEvent(eventType, data);
  }

  // Return null to indicate this event should not be sent
  return null;
}
