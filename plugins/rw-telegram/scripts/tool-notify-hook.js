#!/usr/bin/env node

/**
 * Tool Notification Hook
 *
 * Sends tool execution events to Telegram.
 * The worker will filter based on verbose_mode setting.
 */

import { loadConfig, validateConfig } from '../lib/config.mjs';
import { parseHookInput, outputHookResult, getProjectName, truncate } from '../lib/utils.mjs';

async function main() {
  try {
    const input = await parseHookInput();
    const config = loadConfig();

    // Check if config is valid
    const validation = validateConfig();
    if (!validation.valid) {
      outputHookResult({ continue: true });
      return;
    }

    // Get tool information from hook input
    const toolName = input.tool_name || input.toolName;
    const toolInput = input.tool_input || input.input;
    const toolResult = input.tool_result || input.result;

    if (!toolName) {
      outputHookResult({ continue: true });
      return;
    }

    // Get project name
    const projectName = getProjectName(input.cwd);

    // Send to worker - let worker decide based on verbose_mode
    try {
      await fetch(`http://127.0.0.1:${config.worker_port}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'tool',
          toolName,
          input: typeof toolInput === 'string' ? toolInput : JSON.stringify(toolInput),
          result: truncate(typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult), 500),
          project: projectName,
          data: {
            cwd: input.cwd
          }
        }),
        signal: AbortSignal.timeout(3000)
      });
    } catch {
      // Ignore notification errors - don't block Claude
    }

    outputHookResult({ continue: true });

  } catch (error) {
    // On error, continue anyway
    outputHookResult({ continue: true });
  }
}

main();
