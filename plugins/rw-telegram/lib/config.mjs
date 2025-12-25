/**
 * Configuration management for rw-telegram-claude-plugin
 * Stores config in ~/.claude-telegram/config.json
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR = path.join(os.homedir(), '.claude-telegram');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const PID_FILE = path.join(CONFIG_DIR, 'worker.pid');

const DEFAULT_CONFIG = {
  bot_token: '',
  chat_id: '',
  allowed_user_ids: [],
  worker_port: 37778,
  notifications: {
    on_stop: true,
    on_session_end: true,
    on_error: true
  },
  ask_via_telegram: true
};

/**
 * Ensure config directory exists with proper permissions
 */
export function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { mode: 0o700, recursive: true });
  }
}

/**
 * Load configuration from file
 * @returns {Object} Configuration object
 */
export function loadConfig() {
  ensureConfigDir();

  if (!fs.existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    const config = JSON.parse(content);
    return { ...DEFAULT_CONFIG, ...config };
  } catch (error) {
    console.error('Failed to load config:', error.message);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save configuration to file
 * @param {Object} config - Configuration object to save
 */
export function saveConfig(config) {
  ensureConfigDir();

  const content = JSON.stringify(config, null, 2);
  fs.writeFileSync(CONFIG_FILE, content, { mode: 0o600 });
}

/**
 * Update specific config values
 * @param {Object} updates - Partial config to merge
 * @returns {Object} Updated configuration
 */
export function updateConfig(updates) {
  const config = loadConfig();
  const updated = { ...config, ...updates };
  saveConfig(updated);
  return updated;
}

/**
 * Check if configuration is valid for operation
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateConfig() {
  const config = loadConfig();
  const errors = [];

  if (!config.bot_token) {
    errors.push('bot_token is required');
  }

  if (!config.chat_id) {
    errors.push('chat_id is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get worker PID if running
 * @returns {number|null}
 */
export function getWorkerPid() {
  if (!fs.existsSync(PID_FILE)) {
    return null;
  }

  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    // Check if process is running
    try {
      process.kill(pid, 0);
      return pid;
    } catch {
      // Process not running, clean up stale PID file
      fs.unlinkSync(PID_FILE);
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Save worker PID
 * @param {number} pid
 */
export function saveWorkerPid(pid) {
  ensureConfigDir();
  fs.writeFileSync(PID_FILE, String(pid), { mode: 0o600 });
}

/**
 * Remove worker PID file
 */
export function removeWorkerPid() {
  if (fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE);
  }
}

export {
  CONFIG_DIR,
  CONFIG_FILE,
  PID_FILE,
  DEFAULT_CONFIG
};
