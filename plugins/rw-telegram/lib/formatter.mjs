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
 * Aggressively filters out internal metadata
 */
function cleanSummaryText(text) {
  if (!text) return null;

  let cleaned = String(text).trim();

  // Skip if it's clearly internal metadata JSON
  const internalFields = ['parentUuid', 'sessionId', 'isSidechain', 'userType', 'version'];
  if (internalFields.some(field => cleaned.includes(`"${field}"`))) {
    return null;
  }

  // Try to extract meaningful content from JSON if present
  try {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // Skip internal metadata objects
      if (parsed.parentUuid || parsed.sessionId || parsed.isSidechain !== undefined) {
        return null;
      }

      // Extract meaningful fields
      if (parsed.summary) {
        cleaned = parsed.summary;
      } else if (parsed.message) {
        cleaned = parsed.message;
      } else if (parsed.details) {
        cleaned = parsed.details;
      } else if (parsed.description) {
        cleaned = parsed.description;
      } else if (parsed.result) {
        cleaned = parsed.result;
      } else {
        // No meaningful content found
        return null;
      }
    }
  } catch {
    // Not valid JSON, continue with raw text
  }

  // Remove common noise patterns
  cleaned = cleaned
    .replace(/\{"category":\s*"[^"]+",?\s*"summary":\s*"/g, '')
    .replace(/"\s*\}$/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

  // If still looks like JSON or contains UUID patterns, return null
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    return null;
  }

  // Filter out UUID-heavy strings
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  if ((cleaned.match(uuidPattern) || []).length > 1) {
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
  const time = getShortTime();

  const lines = [];
  lines.push(`${emoji} ${toolName}`);
  lines.push('');

  switch (toolName) {
    case 'Bash': {
      const cmd = extractBashCommand(input);
      if (cmd) {
        lines.push(`Command: ${truncateText(cmd, 100)}`);
      }
      if (result) {
        const resultStr = formatBashResult(result, 200);
        lines.push(`Result: ${resultStr}`);
      }
      break;
    }

    case 'Edit': {
      const filePath = extractFilePath(input);
      if (filePath) {
        lines.push(`File: ${filePath}`);
      }
      try {
        const parsed = typeof input === 'string' ? JSON.parse(input) : input;
        if (parsed.old_string) {
          lines.push(`Changed: ${truncateText(parsed.old_string, 50)} → ${truncateText(parsed.new_string, 50)}`);
        }
      } catch {}
      break;
    }

    case 'Write': {
      const filePath = extractFilePath(input);
      if (filePath) {
        lines.push(`File: ${filePath}`);
        lines.push(`Action: Created/Overwritten`);
      }
      break;
    }

    case 'Read': {
      const filePath = extractFilePath(input);
      if (filePath) {
        lines.push(`File: ${filePath}`);
      }
      if (result) {
        const lineCount = String(result).split('\n').length;
        lines.push(`Lines: ${lineCount}`);
      }
      break;
    }

    case 'Task': {
      try {
        const parsed = typeof input === 'string' ? JSON.parse(input) : input;
        const agentType = parsed.subagent_type || 'unknown';
        const desc = parsed.description || '';
        const prompt = parsed.prompt || '';

        lines.push(`Agent: ${agentType}`);
        if (desc) {
          lines.push(`Task: ${desc}`);
        }
        if (prompt) {
          lines.push(`Prompt: ${truncateText(prompt, 150)}`);
        }
      } catch {}
      break;
    }

    case 'TaskOutput': {
      lines.push(`Status: Retrieving agent output`);
      if (result) {
        lines.push(`Result: ${truncateText(String(result), 200)}`);
      }
      break;
    }

    case 'Glob': {
      try {
        const parsed = typeof input === 'string' ? JSON.parse(input) : input;
        if (parsed.pattern) {
          lines.push(`Pattern: ${parsed.pattern}`);
        }
        if (parsed.path) {
          lines.push(`Path: ${parsed.path}`);
        }
      } catch {}
      if (result) {
        const files = String(result).split('\n').filter(f => f.trim());
        lines.push(`Found: ${files.length} files`);
      }
      break;
    }

    case 'Grep': {
      try {
        const parsed = typeof input === 'string' ? JSON.parse(input) : input;
        if (parsed.pattern) {
          lines.push(`Search: ${parsed.pattern}`);
        }
      } catch {}
      if (result) {
        const matches = String(result).split('\n').filter(f => f.trim());
        lines.push(`Matches: ${matches.length}`);
      }
      break;
    }

    case 'AskUserQuestion': {
      lines[0] = `❓ Question`;
      try {
        const parsed = typeof input === 'string' ? JSON.parse(input) : input;
        if (parsed.questions && parsed.questions[0]) {
          lines.push(parsed.questions[0].question);
          if (parsed.questions[0].options) {
            const opts = parsed.questions[0].options.map(o => o.label).join(', ');
            lines.push(`Options: ${opts}`);
          }
        }
      } catch {}
      break;
    }

    default:
      lines.push(`Input: ${truncateText(JSON.stringify(input), 100)}`);
      if (result) {
        lines.push(`Result: ${truncateText(String(result), 100)}`);
      }
  }

  // Add timestamp at the end
  lines.push('');
  lines.push(`⏰ ${time}`);

  return lines.join('\n');
}

/**
 * Get short time string (HH:MM)
 */
function getShortTime() {
  return new Date().toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Get event type label
 */
function getEventLabel(eventType) {
  const labels = {
    stop: 'Task Complete',
    done: 'Task Complete',
    end: 'Session Ended',
    error: 'Error',
    question: 'Question',
    plan_ready: 'Plan Ready',
    review: 'Review Complete',
    limit: 'Context Limit',
    feature_complete: 'Feature Complete',
    tests_passed: 'Tests Passed',
    tests_failed: 'Tests Failed'
  };
  return labels[eventType] || 'Update';
}

/**
 * Format a summary event (for summary mode)
 * New minimal format: ✅ project | Event Type\n\nsummary\n\n⏰ HH:MM
 */
export function formatSummaryEvent(eventType, data = {}) {
  const project = data.project || 'Claude Code';
  const time = getShortTime();
  const emoji = getStatusEmoji(eventType);
  const label = getEventLabel(eventType);

  // Clean the summary text
  const cleanedSummary = cleanSummaryText(data.summary);

  // Build message parts - minimal format
  const parts = [];

  // Header line: emoji project | label
  parts.push(`${emoji} ${project} | ${label}`);

  // Summary content based on event type
  switch (eventType) {
    case 'stop':
    case 'done':
    case 'review':
    case 'end':
      if (cleanedSummary) {
        parts.push('');
        parts.push(cleanedSummary);
      }
      break;

    case 'feature_complete':
      if (data.featureId) {
        parts.push('');
        parts.push(`Feature: ${data.featureId}`);
      }
      if (cleanedSummary) {
        parts.push('');
        parts.push(cleanedSummary);
      }
      break;

    case 'error':
      if (data.error) {
        const cleanError = cleanSummaryText(data.error) || truncateText(data.error, 200);
        parts.push('');
        parts.push(cleanError);
      }
      break;

    case 'question':
      if (data.question) {
        parts.push('');
        parts.push(data.question);
      }
      break;

    case 'plan_ready':
      parts.push('');
      parts.push('Claude has a plan ready for your approval');
      break;

    case 'limit':
      parts.push('');
      parts.push('Session needs to be compacted or restarted');
      break;

    case 'tests_passed':
      if (data.count) {
        parts.push('');
        parts.push(`${data.count} tests passed`);
      }
      break;

    case 'tests_failed':
      if (data.count) {
        parts.push('');
        parts.push(`${data.count} tests failed`);
      }
      if (cleanedSummary) {
        parts.push('');
        parts.push(cleanedSummary);
      }
      break;

    default:
      if (cleanedSummary) {
        parts.push('');
        parts.push(cleanedSummary);
      }
  }

  // Footer: timestamp only
  parts.push('');
  parts.push(`⏰ ${time}`);

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
