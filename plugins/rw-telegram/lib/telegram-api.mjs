/**
 * Telegram Bot API wrapper
 * Uses native fetch, no external dependencies
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

/**
 * Make a request to Telegram Bot API
 * @param {string} token - Bot token
 * @param {string} method - API method
 * @param {Object} payload - Request payload
 * @returns {Promise<any>} API response result
 */
export async function telegramRequest(token, method, payload = {}) {
  const url = `${TELEGRAM_API_BASE}${token}/${method}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Telegram API ${method} failed: HTTP ${res.status} ${text}`);
  }

  const data = await res.json();

  if (!data.ok) {
    throw new Error(`Telegram API ${method} error: ${JSON.stringify(data)}`);
  }

  return data.result;
}

/**
 * Split long text into chunks for Telegram (max 4096 chars)
 * @param {string} text - Text to split
 * @param {number} maxLength - Max length per chunk
 * @returns {string[]} Array of text chunks
 */
export function chunkText(text, maxLength = 3500) {
  const lines = String(text).split(/\r?\n/);
  const chunks = [];
  let buffer = '';

  for (const line of lines) {
    const next = buffer ? `${buffer}\n${line}` : line;

    if (next.length > maxLength) {
      if (buffer) chunks.push(buffer);

      if (line.length > maxLength) {
        for (let i = 0; i < line.length; i += maxLength) {
          chunks.push(line.slice(i, i + maxLength));
        }
        buffer = '';
      } else {
        buffer = line;
      }
    } else {
      buffer = next;
    }
  }

  if (buffer) chunks.push(buffer);
  return chunks.length ? chunks : [''];
}

/**
 * Send a message to Telegram
 * @param {string} token - Bot token
 * @param {string|number} chatId - Chat ID
 * @param {string} text - Message text
 * @param {Object} options - Additional options
 * @returns {Promise<any>} Sent message
 */
export async function sendMessage(token, chatId, text, options = {}) {
  const chunks = chunkText(text);
  let lastMessage;

  for (const chunk of chunks) {
    lastMessage = await telegramRequest(token, 'sendMessage', {
      chat_id: chatId,
      text: chunk,
      parse_mode: options.parseMode || 'Markdown',
      disable_web_page_preview: true,
      ...options
    });
  }

  return lastMessage;
}

/**
 * Send a message with inline keyboard
 * @param {string} token - Bot token
 * @param {string|number} chatId - Chat ID
 * @param {string} text - Message text
 * @param {Array<Array<{text: string, callback_data: string}>>} keyboard - Inline keyboard
 * @returns {Promise<any>} Sent message
 */
export async function sendMessageWithKeyboard(token, chatId, text, keyboard) {
  return telegramRequest(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

/**
 * Edit message text
 * @param {string} token - Bot token
 * @param {string|number} chatId - Chat ID
 * @param {number} messageId - Message ID to edit
 * @param {string} text - New text
 * @returns {Promise<any>} Edited message
 */
export async function editMessage(token, chatId, messageId, text) {
  return telegramRequest(token, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true
  });
}

/**
 * Answer callback query (for inline keyboard buttons)
 * @param {string} token - Bot token
 * @param {string} callbackQueryId - Callback query ID
 * @param {string} text - Optional notification text
 * @returns {Promise<boolean>}
 */
export async function answerCallbackQuery(token, callbackQueryId, text = '') {
  return telegramRequest(token, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text
  });
}

/**
 * Get updates using long polling
 * @param {string} token - Bot token
 * @param {number} offset - Update offset
 * @param {number} timeout - Long polling timeout in seconds
 * @returns {Promise<any[]>} Array of updates
 */
export async function getUpdates(token, offset = 0, timeout = 50) {
  const result = await telegramRequest(token, 'getUpdates', {
    offset,
    timeout,
    allowed_updates: ['message', 'callback_query']
  });

  return result || [];
}

/**
 * Get bot info
 * @param {string} token - Bot token
 * @returns {Promise<any>} Bot info
 */
export async function getMe(token) {
  return telegramRequest(token, 'getMe');
}

/**
 * Format status emoji
 * @param {string} status - Status type
 * @returns {string} Emoji
 */
export function statusEmoji(status) {
  const emojis = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    working: '🔄',
    done: '🎉',
    question: '❓',
    stop: '⏸️',
    end: '🏁'
  };

  return emojis[status] || '🤖';
}

/**
 * Format a notification message
 * @param {string} message - Message content
 * @param {Object} options - Formatting options
 * @returns {string} Formatted message
 */
export function formatNotification(message, options = {}) {
  const emoji = statusEmoji(options.status || 'info');
  const project = options.project || 'Claude Code';
  const timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  const cwd = options.cwd || '';

  let formatted = `${emoji} *${project}*`;
  if (cwd) {
    formatted += `\n📂 \`${cwd}\``;
  }
  formatted += `\n\n${message}\n\n_${timestamp}_`;

  return formatted;
}
