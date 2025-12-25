#!/usr/bin/env node

/**
 * Worker CLI for rw-telegram-claude-plugin
 *
 * Commands:
 *   start   - Start the worker in background
 *   stop    - Stop the running worker
 *   restart - Restart the worker
 *   status  - Check worker status
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getWorkerPid,
  removeWorkerPid,
  loadConfig,
  validateConfig,
  CONFIG_DIR
} from '../lib/config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_FILE = path.join(CONFIG_DIR, 'worker.log');
const WORKER_SCRIPT = path.join(__dirname, 'worker.mjs');

function log(message) {
  console.log(`[telegram-worker] ${message}`);
}

function logError(message) {
  console.error(`[telegram-worker] ERROR: ${message}`);
}

/**
 * Check if worker is running
 */
function isWorkerRunning() {
  const pid = getWorkerPid();
  return pid !== null;
}

/**
 * Start worker in background
 */
function startWorker() {
  // Check config
  const validation = validateConfig();
  if (!validation.valid) {
    logError('Configuration invalid:');
    validation.errors.forEach(e => logError(`  - ${e}`));
    logError('Run /telegram-setup to configure the plugin.');
    process.exit(1);
  }

  // Check if already running
  if (isWorkerRunning()) {
    const pid = getWorkerPid();
    log(`Worker already running (PID: ${pid})`);
    return;
  }

  // Ensure log directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }

  // Open log file
  const logStream = fs.openSync(LOG_FILE, 'a');

  // Spawn worker
  const child = spawn('node', [WORKER_SCRIPT], {
    detached: true,
    stdio: ['ignore', logStream, logStream],
    cwd: path.dirname(__dirname)
  });

  child.unref();

  log(`Worker started (PID: ${child.pid})`);
  log(`Logs: ${LOG_FILE}`);
}

/**
 * Stop worker
 */
function stopWorker() {
  const pid = getWorkerPid();

  if (!pid) {
    log('Worker is not running');
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
    log(`Sent SIGTERM to worker (PID: ${pid})`);

    // Wait a bit and force kill if needed
    setTimeout(() => {
      try {
        process.kill(pid, 0);
        // Still running, force kill
        process.kill(pid, 'SIGKILL');
        log(`Sent SIGKILL to worker (PID: ${pid})`);
      } catch {
        // Process already dead
      }
      removeWorkerPid();
    }, 2000);

  } catch (error) {
    if (error.code === 'ESRCH') {
      log('Worker process not found, cleaning up PID file');
      removeWorkerPid();
    } else {
      logError(`Failed to stop worker: ${error.message}`);
    }
  }
}

/**
 * Show worker status
 */
async function showStatus() {
  const pid = getWorkerPid();
  const config = loadConfig();

  console.log('\n=== Telegram Worker Status ===\n');

  if (pid) {
    console.log(`Status: 🟢 Running (PID: ${pid})`);
  } else {
    console.log('Status: ⚪ Stopped');
  }

  console.log(`Port: ${config.worker_port}`);
  console.log(`Chat ID: ${config.chat_id || 'Not configured'}`);
  console.log(`Bot Token: ${config.bot_token ? '✓ Set' : '✗ Not set'}`);
  console.log(`Log File: ${LOG_FILE}`);

  // Try to check health endpoint
  if (pid) {
    try {
      const res = await fetch(`http://127.0.0.1:${config.worker_port}/health`);
      if (res.ok) {
        const data = await res.json();
        console.log(`Uptime: ${Math.round(data.uptime)}s`);
      }
    } catch {
      console.log('Health: ⚠️ Not responding (may be starting up)');
    }
  }

  console.log('\n');
}

/**
 * Show last N lines of log
 */
function showLogs(lines = 50) {
  if (!fs.existsSync(LOG_FILE)) {
    log('No log file found');
    return;
  }

  const content = fs.readFileSync(LOG_FILE, 'utf8');
  const allLines = content.split('\n');
  const lastLines = allLines.slice(-lines);

  console.log(`\n=== Last ${lines} lines of worker log ===\n`);
  console.log(lastLines.join('\n'));
}

// Main
const command = process.argv[2];

switch (command) {
  case 'start':
    startWorker();
    break;

  case 'stop':
    stopWorker();
    break;

  case 'restart':
    stopWorker();
    setTimeout(startWorker, 3000);
    break;

  case 'status':
    showStatus();
    break;

  case 'logs':
    const lines = parseInt(process.argv[3], 10) || 50;
    showLogs(lines);
    break;

  default:
    console.log(`
Usage: node worker-cli.js <command>

Commands:
  start     Start the worker in background
  stop      Stop the running worker
  restart   Restart the worker
  status    Check worker status
  logs [n]  Show last n lines of log (default: 50)
`);
    process.exit(1);
}
