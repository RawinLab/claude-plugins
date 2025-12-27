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
  const emoji = getStatusEmoji(eventType);
  const project = data.project || 'Claude Code';
  const timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

  let message = `${emoji} *${project}*\n`;

  switch (eventType) {
    case 'stop':
    case 'done':
      message += '\n✅ Task Complete';
      if (data.summary) {
        message += `\n\n${data.summary}`;
      }
      break;

    case 'feature_complete':
      message += `\n🎯 Feature Complete: ${data.featureId || 'unknown'}`;
      if (data.filesChanged) {
        message += `\n📁 ${data.filesChanged} files changed`;
      }
      if (data.testsResult) {
        message += `\n${data.testsResult}`;
      }
      break;

    case 'error':
      message += '\n❌ Error Occurred';
      if (data.error) {
        message += `\n\n\`\`\`\n${truncateText(data.error, 200)}\n\`\`\``;
      }
      break;

    case 'question':
      message += '\n❓ Question from Claude';
      if (data.question) {
        message += `\n\n${data.question}`;
      }
      break;

    case 'plan_ready':
      message += '\n📋 Plan Ready for Approval';
      break;

    case 'review':
      message += '\n🔍 Review Complete';
      if (data.summary) {
        message += `\n\n${data.summary}`;
      }
      break;

    case 'limit':
      message += '\n⏱️ Context Limit Reached';
      break;

    case 'end':
      message += '\n🏁 Session Ended';
      break;

    case 'tests_passed':
      message += '\n✅ All Tests Passed';
      if (data.count) {
        message += ` (${data.count} tests)`;
      }
      break;

    case 'tests_failed':
      message += '\n❌ Tests Failed';
      if (data.count) {
        message += ` (${data.count} failed)`;
      }
      break;

    default:
      if (data.summary) {
        message += `\n\n${data.summary}`;
      }
  }

  if (data.cwd) {
    message += `\n\n📂 \`${data.cwd}\``;
  }

  message += `\n\n_${timestamp}_`;

  return message;
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
