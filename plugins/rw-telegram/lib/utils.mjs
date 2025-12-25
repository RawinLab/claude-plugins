/**
 * Shared utilities for rw-telegram-claude-plugin
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get current ISO timestamp
 * @returns {string}
 */
export function nowIso() {
  return new Date().toISOString();
}

/**
 * Log with timestamp
 * @param  {...any} args - Arguments to log
 */
export function log(...args) {
  console.log(`[${nowIso()}]`, ...args);
}

/**
 * Log error with timestamp
 * @param  {...any} args - Arguments to log
 */
export function logError(...args) {
  console.error(`[${nowIso()}] ERROR:`, ...args);
}

/**
 * Strip ANSI escape codes from text
 * @param {string} input - Text with ANSI codes
 * @returns {string} Clean text
 */
export function stripAnsi(input) {
  return String(input).replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncate(text, maxLength = 500) {
  const str = String(text);
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Generate a correlation ID
 * @param {string} prefix - ID prefix
 * @returns {string} Correlation ID
 */
export function generateCorrelationId(prefix = 'req') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Parse command from message text
 * @param {string} text - Message text
 * @returns {{ cmd: string|null, rest: string }}
 */
export function parseCommand(text) {
  const trimmed = String(text || '').trim();

  if (!trimmed.startsWith('/')) {
    return { cmd: null, rest: trimmed };
  }

  const [first, ...rest] = trimmed.split(' ');
  // Remove @botname suffix if present
  const cmd = first.split('@')[0].toLowerCase();

  return { cmd, rest: rest.join(' ').trim() };
}

/**
 * Read the last N lines from a file
 * @param {string} filePath - Path to file
 * @param {number} n - Number of lines
 * @returns {string[]} Array of lines
 */
export function readLastLines(filePath, n = 50) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    return lines.slice(-n);
  } catch {
    return [];
  }
}

/**
 * Extract project name from working directory
 * @param {string} cwd - Current working directory
 * @returns {string} Project name
 */
export function getProjectName(cwd) {
  return path.basename(cwd || process.cwd());
}

/**
 * Check if a user ID is in the allowed list
 * @param {number} userId - User ID to check
 * @param {number[]} allowedIds - List of allowed IDs
 * @returns {boolean}
 */
export function isUserAllowed(userId, allowedIds) {
  if (!Array.isArray(allowedIds) || allowedIds.length === 0) {
    return true; // If no whitelist, allow all
  }
  return allowedIds.includes(userId);
}

/**
 * Format questions for Telegram display
 * @param {Array<{question: string, options: Array<{label: string, description?: string}>}>} questions
 * @returns {{ text: string, keyboard: Array<Array<{text: string, callback_data: string}>> }}
 */
export function formatQuestionsForTelegram(questions) {
  const lines = [];
  const keyboard = [];

  questions.forEach((q, qIndex) => {
    lines.push(`*${qIndex + 1}. ${q.question}*`);

    if (q.options && q.options.length > 0) {
      const row = [];
      q.options.forEach((opt, optIndex) => {
        lines.push(`   ${optIndex + 1}) ${opt.label}${opt.description ? ` - ${opt.description}` : ''}`);
        row.push({
          text: opt.label,
          callback_data: JSON.stringify({ q: qIndex, o: optIndex })
        });
      });
      keyboard.push(row);
    }

    lines.push('');
  });

  // Add "Other" option
  keyboard.push([{ text: '📝 Other (type response)', callback_data: JSON.stringify({ other: true }) }]);

  return {
    text: lines.join('\n'),
    keyboard
  };
}

/**
 * Parse hook input from stdin
 * @returns {Promise<Object>} Parsed hook input
 */
export async function parseHookInput() {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error(`Failed to parse hook input: ${error.message}`));
      }
    });

    process.stdin.on('error', reject);
  });
}

/**
 * Output hook result
 * @param {Object} result - Hook result
 */
export function outputHookResult(result) {
  console.log(JSON.stringify(result));
}
