#!/usr/bin/env node

/**
 * SessionStart Hook: Ensure worker is running
 *
 * This hook runs at session start to verify the background worker
 * is active. If not, it attempts to start it.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getWorkerPid, loadConfig, validateConfig } from '../lib/config.mjs';
import { parseHookInput, outputHookResult } from '../lib/utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    // Check if worker is running
    const pid = getWorkerPid();

    if (!pid) {
      // Worker not running, try to start it
      try {
        const workerCli = path.join(__dirname, 'worker-cli.js');
        spawn('node', [workerCli, 'start'], {
          detached: true,
          stdio: 'ignore'
        }).unref();

        // Wait a bit for worker to start
        await new Promise(resolve => setTimeout(resolve, 2000));

        outputHookResult({
          continue: true,
          systemMessage: 'Telegram worker started. Notifications will be sent to Telegram.'
        });
      } catch (error) {
        outputHookResult({
          continue: true,
          systemMessage: `Failed to start Telegram worker: ${error.message}`
        });
      }
      return;
    }

    // Worker is running, update session info
    try {
      const sessionInfo = {
        active: true,
        cwd: input.cwd,
        startedAt: Date.now()
      };

      await fetch(`http://127.0.0.1:${config.worker_port}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionInfo),
        signal: AbortSignal.timeout(5000)
      });
    } catch {
      // Ignore errors updating session
    }

    outputHookResult({ continue: true });

  } catch (error) {
    // On error, continue anyway
    outputHookResult({
      continue: true,
      systemMessage: `Telegram hook error: ${error.message}`
    });
  }
}

main();
