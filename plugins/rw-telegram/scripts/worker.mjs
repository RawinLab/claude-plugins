#!/usr/bin/env node

/**
 * Background Worker for rw-telegram-claude-plugin
 *
 * This worker:
 * 1. Maintains Telegram long-polling connection
 * 2. Provides HTTP API for hooks to communicate
 * 3. Handles pending questions and responses
 * 4. Queues remote commands from Telegram
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import { loadConfig, saveWorkerPid, removeWorkerPid, updateConfig } from '../lib/config.mjs';
import {
  getUpdates,
  sendMessage,
  sendMessageWithKeyboard,
  answerCallbackQuery,
  formatNotification,
  statusEmoji
} from '../lib/telegram-api.mjs';
import {
  formatNotificationMessage,
  formatSummaryEvent,
  isSummaryEvent
} from '../lib/formatter.mjs';
import {
  log,
  logError,
  sleep,
  parseCommand,
  isUserAllowed,
  generateCorrelationId,
  formatQuestionsForTelegram
} from '../lib/utils.mjs';

// Store for pending questions awaiting responses
const pendingQuestions = new Map();

// Store for received responses
const responses = new Map();

// Queue for commands from Telegram
const commandQueue = [];

// Current session info
let sessionInfo = {
  active: false,
  cwd: null,
  startedAt: null
};

let config = null;
let pollingOffset = 0;
let isShuttingDown = false;

// ============================================
// TMUX Integration for Claude Code Control
// ============================================

const DEFAULT_TMUX_SESSION = 'claude-telegram';
const DEFAULT_CLAUDE_CMD = 'claude --dangerously-skip-permissions';

/**
 * Run a process and get output
 */
function runProcess(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString('utf8')));
    child.stderr.on('data', (d) => (stderr += d.toString('utf8')));

    child.on('close', (code, signal) => {
      resolve({ code, signal, stdout, stderr });
    });
  });
}

/**
 * Execute tmux command
 */
async function tmux(args, options = {}) {
  return runProcess('tmux', args, options);
}

/**
 * Check if tmux is available
 */
async function hasTmux() {
  const r = await runProcess('bash', ['-lc', 'command -v tmux >/dev/null 2>&1']);
  return r.code === 0;
}

/**
 * Get tmux session name from config
 */
function getTmuxSession() {
  return config.tmux_session || DEFAULT_TMUX_SESSION;
}

/**
 * Get Claude command from config
 */
function getClaudeCmd() {
  return config.claude_cmd || DEFAULT_CLAUDE_CMD;
}

/**
 * Get working directory from config or session
 */
function getWorkdir() {
  return config.workdir || sessionInfo.cwd || process.cwd();
}

/**
 * Check if tmux session exists
 */
async function tmuxSessionExists() {
  const session = getTmuxSession();
  const check = await tmux(['has-session', '-t', session]);
  return check.code === 0;
}

/**
 * Start tmux session with Claude
 */
async function tmuxStart() {
  const has = await hasTmux();
  if (!has) {
    throw new Error('tmux not found. Install tmux first.');
  }

  if (await tmuxSessionExists()) {
    return { started: false, message: 'Session already running' };
  }

  const session = getTmuxSession();
  const claudeCmd = getClaudeCmd();
  const workdir = getWorkdir();

  const start = await tmux([
    'new-session', '-d', '-s', session, '-c', workdir,
    'bash', '-lc', claudeCmd
  ], { cwd: workdir });

  if (start.code !== 0) {
    throw new Error(`Failed to start tmux: ${start.stderr || start.stdout}`);
  }

  return { started: true, message: 'Session started' };
}

/**
 * Send text to tmux session
 */
async function tmuxSend(text) {
  if (!text) {
    throw new Error('No text to send');
  }

  if (!(await tmuxSessionExists())) {
    // Auto-start session if not running
    await tmuxStart();
    await sleep(1000); // Wait for Claude to initialize
  }

  const session = getTmuxSession();
  const trimmed = text.slice(0, 4000);

  const r = await tmux(['send-keys', '-t', session, trimmed, 'Enter']);
  if (r.code !== 0) {
    throw new Error(`tmux send-keys failed: ${r.stderr || r.stdout}`);
  }

  return { sent: true };
}

/**
 * Get last N lines from tmux session
 */
async function tmuxTail(lines = 50) {
  if (!(await tmuxSessionExists())) {
    throw new Error('No tmux session running');
  }

  const session = getTmuxSession();
  const n = Math.max(10, Math.min(500, lines));

  const r = await tmux(['capture-pane', '-p', '-t', session, '-S', `-${n}`]);
  if (r.code !== 0) {
    throw new Error(`tmux capture-pane failed: ${r.stderr || r.stdout}`);
  }

  // Strip ANSI codes
  return (r.stdout || '').replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '').trimEnd();
}

/**
 * Stop tmux session
 */
async function tmuxStop() {
  if (!(await tmuxSessionExists())) {
    return { stopped: false, message: 'No session running' };
  }

  const session = getTmuxSession();
  const r = await tmux(['kill-session', '-t', session]);

  if (r.code !== 0) {
    throw new Error(`tmux kill-session failed: ${r.stderr || r.stdout}`);
  }

  return { stopped: true, message: 'Session stopped' };
}

/**
 * Handle incoming Telegram message
 */
async function handleMessage(message) {
  const chatId = message.chat.id;
  const userId = message.from?.id;
  const text = message.text || '';

  // Check authorization
  if (!isUserAllowed(userId, config.allowed_user_ids)) {
    await sendMessage(config.bot_token, chatId,
      '❌ Unauthorized. Your user ID is not in the allowed list.');
    return;
  }

  const { cmd, rest } = parseCommand(text);

  // If no command and we have a pending question awaiting text response
  if (!cmd) {
    const pendingTextResponse = Array.from(pendingQuestions.entries())
      .find(([, q]) => q.awaitingTextResponse);

    if (pendingTextResponse) {
      const [correlationId, question] = pendingTextResponse;
      question.awaitingTextResponse = false;

      // Store the response
      responses.set(correlationId, {
        type: 'text',
        value: text,
        timestamp: Date.now()
      });

      pendingQuestions.delete(correlationId);

      await sendMessage(config.bot_token, chatId,
        `✅ Response received: "${text}"`);
      return;
    }

    // No pending question, just acknowledge
    return;
  }

  // Handle commands
  switch (cmd) {
    case '/start':
    case '/help':
      await sendMessage(config.bot_token, chatId, [
        '*Claude Code Telegram Bot* 🤖',
        '',
        '*Session Commands:*',
        '/status - Show current status',
        '/help - Show this help',
        '/cancel - Cancel pending question',
        '/verbose - Toggle notification mode',
        '',
        '*Claude Control (tmux):*',
        '/cd <path> - Set working directory',
        '/tmux\\_start - Start Claude in tmux session',
        '/tmux\\_stop - Stop tmux session',
        '/tmux\\_tail [n] - Show last n lines (default 50)',
        '/send <prompt> - Send prompt to Claude',
        '',
        '*Notification Modes:*',
        '📢 Verbose: All events formatted nicely',
        '📋 Summary: Only important events (default)'
      ].join('\n'));
      break;

    case '/status':
      try {
        const tmuxRunning = await tmuxSessionExists();
        const workdir = getWorkdir();
        const statusLines = [
          '*Status*',
          '',
          `Claude Session: ${sessionInfo.active ? '🟢 Active' : '⚪ Inactive'}`,
          `Tmux Session: ${tmuxRunning ? '🟢 Running' : '⚪ Not running'}`,
          `📂 Workdir: \`${workdir}\``,
          sessionInfo.startedAt ? `Started: ${new Date(sessionInfo.startedAt).toLocaleString('th-TH')}` : '',
          '',
          `Pending questions: ${pendingQuestions.size}`,
          `Queued commands: ${commandQueue.length}`
        ].filter(Boolean);

        await sendMessage(config.bot_token, chatId, statusLines.join('\n'));
      } catch (error) {
        await sendMessage(config.bot_token, chatId, `Status check error: ${error.message}`);
      }
      break;

    case '/cancel':
      if (pendingQuestions.size === 0) {
        await sendMessage(config.bot_token, chatId, 'No pending questions to cancel.');
      } else {
        for (const [correlationId] of pendingQuestions) {
          responses.set(correlationId, {
            type: 'cancelled',
            value: null,
            timestamp: Date.now()
          });
        }
        pendingQuestions.clear();
        await sendMessage(config.bot_token, chatId, '✅ All pending questions cancelled.');
      }
      break;

    case '/verbose': {
      const arg = rest?.toLowerCase();
      if (arg === 'on' || arg === 'true') {
        config.verbose_mode = true;
        updateConfig({ verbose_mode: true });
        await sendMessage(config.bot_token, chatId,
          '📢 *Verbose Mode: ON*\n\nAll tool events will be sent (formatted nicely):\n🔨 Bash commands\n📝 File edits\n📖 File reads\n🤖 Agent spawns');
      } else if (arg === 'off' || arg === 'false') {
        config.verbose_mode = false;
        updateConfig({ verbose_mode: false });
        await sendMessage(config.bot_token, chatId,
          '📋 *Summary Mode: ON*\n\nOnly important events will be sent:\n✅ Task complete\n❌ Errors\n❓ Questions\n📋 Plan ready');
      } else {
        // Toggle or show status
        if (!arg || arg === 'status') {
          const mode = config.verbose_mode ? '📢 Verbose' : '📋 Summary';
          await sendMessage(config.bot_token, chatId,
            `*Current Mode:* ${mode}\n\nUse:\n/verbose on - Enable verbose mode\n/verbose off - Enable summary mode`);
        } else {
          // Toggle
          config.verbose_mode = !config.verbose_mode;
          updateConfig({ verbose_mode: config.verbose_mode });
          const mode = config.verbose_mode ? '📢 Verbose' : '📋 Summary';
          await sendMessage(config.bot_token, chatId, `*Mode changed to:* ${mode}`);
        }
      }
      break;
    }

    // ============================================
    // TMUX Commands for Claude Control
    // ============================================

    case '/tmux_start':
      try {
        const result = await tmuxStart();
        await sendMessage(config.bot_token, chatId,
          result.started
            ? '✅ Claude tmux session started!\nUse /send <prompt> to send commands.'
            : `ℹ️ ${result.message}`
        );
      } catch (error) {
        await sendMessage(config.bot_token, chatId, `❌ Error: ${error.message}`);
      }
      break;

    case '/tmux_stop':
      try {
        const result = await tmuxStop();
        await sendMessage(config.bot_token, chatId,
          result.stopped ? '✅ Tmux session stopped.' : `ℹ️ ${result.message}`
        );
      } catch (error) {
        await sendMessage(config.bot_token, chatId, `❌ Error: ${error.message}`);
      }
      break;

    case '/tmux_tail':
      try {
        const lines = parseInt(rest, 10) || 50;
        const output = await tmuxTail(lines);
        if (output) {
          await sendMessage(config.bot_token, chatId,
            `*Last ${lines} lines:*\n\`\`\`\n${output.slice(-3000)}\n\`\`\``
          );
        } else {
          await sendMessage(config.bot_token, chatId, 'No output captured.');
        }
      } catch (error) {
        await sendMessage(config.bot_token, chatId, `❌ Error: ${error.message}`);
      }
      break;

    case '/cd':
      // Change working directory
      if (!rest) {
        await sendMessage(config.bot_token, chatId,
          `Current workdir: \`${getWorkdir()}\`\n\nUsage: /cd <path>`
        );
        break;
      }
      try {
        // Update config workdir
        config.workdir = rest;
        await sendMessage(config.bot_token, chatId,
          `✅ Workdir changed to:\n\`${rest}\``
        );
      } catch (error) {
        await sendMessage(config.bot_token, chatId, `❌ Error: ${error.message}`);
      }
      break;

    case '/send':
      if (!rest) {
        await sendMessage(config.bot_token, chatId,
          `Usage: /send <prompt>\n\nExample: /send Fix the bug in auth.js\n\nCurrent workdir: \`${getWorkdir()}\`\nUse /cd <path> to change directory first.\n\n_Note: Claude will read CLAUDE.md first before executing._`
        );
        break;
      }
      try {
        const workdir = getWorkdir();

        // Build prompt with CLAUDE.md instruction
        const fullPrompt = `First, read the CLAUDE.md file in ${workdir} if it exists to understand the project context. Then execute this task: ${rest}`;

        await tmuxSend(fullPrompt);
        await sendMessage(config.bot_token, chatId,
          `✅ Sent to Claude:\n\n📂 Path: \`${workdir}\`\n📄 Will read: \`CLAUDE.md\`\n💬 Task: \`${rest.slice(0, 120)}${rest.length > 120 ? '...' : ''}\`\n\nUse /tmux\\_tail to see response.`
        );
      } catch (error) {
        await sendMessage(config.bot_token, chatId, `❌ Error: ${error.message}`);
      }
      break;

    default:
      // If message starts with text (not a command), treat as prompt to send
      if (!cmd.startsWith('/')) {
        // This shouldn't happen since we check for / at the start
        break;
      }
      await sendMessage(config.bot_token, chatId,
        `Unknown command: ${cmd}\nUse /help to see available commands.`);
  }
}

/**
 * Handle callback query (inline keyboard button press)
 */
async function handleCallbackQuery(callbackQuery) {
  const userId = callbackQuery.from?.id;
  const chatId = callbackQuery.message?.chat?.id;

  // Check authorization
  if (!isUserAllowed(userId, config.allowed_user_ids)) {
    await answerCallbackQuery(config.bot_token, callbackQuery.id, 'Unauthorized');
    return;
  }

  try {
    const data = JSON.parse(callbackQuery.data);

    // Handle "Other" option - wait for text response
    if (data.other) {
      // Find the pending question
      const pending = Array.from(pendingQuestions.entries())[0];
      if (pending) {
        const [, question] = pending;
        question.awaitingTextResponse = true;
        await answerCallbackQuery(config.bot_token, callbackQuery.id);
        await sendMessage(config.bot_token, chatId,
          '📝 Please type your response:');
      }
      return;
    }

    // Handle option selection
    const { q: questionIndex, o: optionIndex } = data;

    // Find the pending question
    const pending = Array.from(pendingQuestions.entries())[0];
    if (!pending) {
      await answerCallbackQuery(config.bot_token, callbackQuery.id, 'Question expired');
      return;
    }

    const [correlationId, question] = pending;
    const selectedOption = question.questions[questionIndex]?.options?.[optionIndex];

    if (!selectedOption) {
      await answerCallbackQuery(config.bot_token, callbackQuery.id, 'Invalid option');
      return;
    }

    // Store the response
    responses.set(correlationId, {
      type: 'option',
      questionIndex,
      optionIndex,
      value: selectedOption.label,
      timestamp: Date.now()
    });

    pendingQuestions.delete(correlationId);

    await answerCallbackQuery(config.bot_token, callbackQuery.id, 'Response recorded');
    await sendMessage(config.bot_token, chatId,
      `✅ Selected: *${selectedOption.label}*`);

  } catch (error) {
    logError('Callback query error:', error);
    await answerCallbackQuery(config.bot_token, callbackQuery.id, 'Error processing');
  }
}

/**
 * Start Telegram long-polling loop
 */
async function startPolling() {
  log('Starting Telegram polling...');

  while (!isShuttingDown) {
    try {
      const updates = await getUpdates(config.bot_token, pollingOffset, 50);

      for (const update of updates) {
        pollingOffset = update.update_id + 1;

        if (update.message) {
          await handleMessage(update.message);
        } else if (update.callback_query) {
          await handleCallbackQuery(update.callback_query);
        }
      }
    } catch (error) {
      logError('Polling error:', error.message);
      await sleep(2000);
    }
  }
}

/**
 * Parse JSON body from request
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * HTTP API request handler
 */
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${config.worker_port}`);
  const path = url.pathname;
  const method = req.method;

  try {
    // Health check
    if (path === '/health' && method === 'GET') {
      return sendJson(res, 200, { status: 'ok', uptime: process.uptime() });
    }

    // Send notification
    if (path === '/api/notify' && method === 'POST') {
      const body = await parseBody(req);
      const { message, status, project, eventType, toolName, input, result, data } = body;

      // Use new formatter if eventType is provided
      if (eventType) {
        const formattedMessage = formatNotificationMessage(
          eventType,
          { project, toolName, input, result, ...data },
          config.verbose_mode
        );

        // If null, skip sending (summary mode filters this event)
        if (!formattedMessage) {
          return sendJson(res, 200, { success: true, skipped: true });
        }

        await sendMessage(config.bot_token, config.chat_id, formattedMessage);
        return sendJson(res, 200, { success: true });
      }

      // Legacy format: use old formatter
      if (!message) {
        return sendJson(res, 400, { error: 'message or eventType required' });
      }

      const formattedMessage = formatNotification(message, { status, project });
      await sendMessage(config.bot_token, config.chat_id, formattedMessage);

      return sendJson(res, 200, { success: true });
    }

    // Send question and wait for response
    if (path === '/api/ask' && method === 'POST') {
      const body = await parseBody(req);
      const { questions, timeout = 300000 } = body;

      if (!questions || !Array.isArray(questions)) {
        return sendJson(res, 400, { error: 'questions array required' });
      }

      const correlationId = generateCorrelationId('ask');
      const { text, keyboard } = formatQuestionsForTelegram(questions);

      // Store pending question
      pendingQuestions.set(correlationId, {
        questions,
        createdAt: Date.now(),
        awaitingTextResponse: false
      });

      // Send to Telegram
      const emoji = statusEmoji('question');
      await sendMessageWithKeyboard(
        config.bot_token,
        config.chat_id,
        `${emoji} *Claude needs your input*\n\n${text}`,
        keyboard
      );

      // Wait for response with timeout
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        if (responses.has(correlationId)) {
          const response = responses.get(correlationId);
          responses.delete(correlationId);
          return sendJson(res, 200, { success: true, response });
        }

        await sleep(500);
      }

      // Timeout - clean up
      pendingQuestions.delete(correlationId);
      return sendJson(res, 408, { error: 'timeout', correlationId });
    }

    // Check for response (non-blocking)
    if (path.startsWith('/api/response/') && method === 'GET') {
      const correlationId = path.split('/').pop();

      if (responses.has(correlationId)) {
        const response = responses.get(correlationId);
        responses.delete(correlationId);
        return sendJson(res, 200, { found: true, response });
      }

      return sendJson(res, 200, { found: false });
    }

    // Update session info
    if (path === '/api/session' && method === 'POST') {
      const body = await parseBody(req);
      sessionInfo = { ...sessionInfo, ...body };
      return sendJson(res, 200, { success: true });
    }

    // Get queued commands
    if (path === '/api/commands' && method === 'GET') {
      const commands = [...commandQueue];
      commandQueue.length = 0;
      return sendJson(res, 200, { commands });
    }

    // Not found
    sendJson(res, 404, { error: 'not found' });

  } catch (error) {
    logError('Request error:', error);
    sendJson(res, 500, { error: error.message });
  }
}

/**
 * Start HTTP server
 */
function startHttpServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handleRequest);

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`Port ${config.worker_port} is already in use`));
      } else {
        reject(error);
      }
    });

    server.listen(config.worker_port, '127.0.0.1', () => {
      log(`HTTP server listening on http://127.0.0.1:${config.worker_port}`);
      resolve(server);
    });
  });
}

/**
 * Graceful shutdown
 */
function setupShutdownHandlers(server) {
  const shutdown = async (signal) => {
    log(`Received ${signal}, shutting down...`);
    isShuttingDown = true;

    server.close(() => {
      log('HTTP server closed');
    });

    removeWorkerPid();

    // Send shutdown notification
    try {
      await sendMessage(config.bot_token, config.chat_id,
        formatNotification('Worker stopped', { status: 'end' }));
    } catch {
      // Ignore errors during shutdown
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Main entry point
 */
async function main() {
  log('Starting rw-telegram-claude-plugin worker...');

  // Load configuration
  config = loadConfig();

  if (!config.bot_token || !config.chat_id) {
    logError('Configuration incomplete. Run /telegram-setup first.');
    process.exit(1);
  }

  // Save PID
  saveWorkerPid(process.pid);

  try {
    // Start HTTP server
    const server = await startHttpServer();
    setupShutdownHandlers(server);

    // Send startup notification
    await sendMessage(config.bot_token, config.chat_id,
      formatNotification('Worker started', { status: 'success' }));

    // Start polling loop
    await startPolling();

  } catch (error) {
    logError('Worker failed:', error);
    removeWorkerPid();
    process.exit(1);
  }
}

main();
