#!/usr/bin/env node

/**
 * SessionStart Hook: Ensure worker is running
 *
 * This hook runs at session start to verify the background worker
 * is active. If not, it attempts to start it.
 *
 * Shared Worker Design:
 * - Worker runs globally (not per-project)
 * - Config stored in ~/.claude-telegram/
 * - PID file ensures only one worker runs
 * - Port check prevents duplicate workers
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { getWorkerPid, loadConfig, validateConfig } from '../lib/config.mjs';
import { parseHookInput, outputHookResult } from '../lib/utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Check if port is in use (worker might be running without PID file)
 */
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true); // Port is in use
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false); // Port is free
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Check if worker is actually responding
 */
async function isWorkerResponding(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  try {
    const input = await parseHookInput();

    // Update session info in worker
    const config = loadConfig();

    // Check if config is valid
    const validation = validateConfig();
    if (!validation.valid) {
      outputHookResult({
        continue: true,
        systemMessage: 'Telegram plugin not configured. Run /telegram-setup to configure.'
      });
      return;
    }

    const port = config.worker_port || 37778;

    // Check if worker is running using multiple methods:
    // 1. PID file check
    // 2. Port availability check
    // 3. Health endpoint check

    const pid = getWorkerPid();
    const portInUse = await isPortInUse(port);
    const workerResponding = portInUse ? await isWorkerResponding(port) : false;

    // Worker is already running and healthy
    if (pid && workerResponding) {
      // Just update session info
      try {
        const sessionInfo = {
          active: true,
          cwd: input.cwd,
          startedAt: Date.now()
        };

        await fetch(`http://127.0.0.1:${port}/api/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionInfo),
          signal: AbortSignal.timeout(5000)
        });
      } catch {
        // Ignore errors updating session
      }

      outputHookResult({ continue: true });
      return;
    }

    // Port is in use but worker not responding (orphaned process)
    if (portInUse && !workerResponding) {
      outputHookResult({
        continue: true,
        systemMessage: `Telegram worker port ${port} is in use but not responding. Try killing orphaned process.`
      });
      return;
    }

    // Worker not running, start it
    try {
      const workerCli = path.join(__dirname, 'worker-cli.js');
      spawn('node', [workerCli, 'start'], {
        detached: true,
        stdio: 'ignore'
      }).unref();

      // Wait a bit for worker to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify it started successfully
      const started = await isWorkerResponding(port);
      if (started) {
        // Update session info
        try {
          await fetch(`http://127.0.0.1:${port}/api/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              active: true,
              cwd: input.cwd,
              startedAt: Date.now()
            }),
            signal: AbortSignal.timeout(5000)
          });
        } catch {
          // Ignore
        }

        outputHookResult({
          continue: true,
          systemMessage: 'Telegram worker started. Notifications will be sent to Telegram.'
        });
      } else {
        outputHookResult({
          continue: true,
          systemMessage: 'Telegram worker started but may not be responding yet.'
        });
      }
    } catch (error) {
      outputHookResult({
        continue: true,
        systemMessage: `Failed to start Telegram worker: ${error.message}`
      });
    }
  } catch (error) {
    // On error, continue anyway
    outputHookResult({
      continue: true,
      systemMessage: `Telegram hook error: ${error.message}`
    });
  }
}

main();
