#!/usr/bin/env node

/**
 * Tool Notification Hook (Simplified)
 *
 * Sends simple task completion notifications to Telegram.
 * Only for: Bash, Task, TaskOutput
 * NOT for: Read, Write, Edit (too noisy)
 */

import { loadConfig, validateConfig } from '../lib/config.mjs';
import { parseHookInput, outputHookResult, getProjectName } from '../lib/utils.mjs';

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

    // Get tool information
    const toolName = input.tool_name || input.toolName;

    if (!toolName) {
      outputHookResult({ continue: true });
      return;
    }

    // Skip if not in allowed tools (extra safety)
    const allowedTools = ['Bash', 'Task', 'TaskOutput'];
    if (!allowedTools.includes(toolName)) {
      outputHookResult({ continue: true });
      return;
    }

    // Get project name
    const projectName = getProjectName(input.cwd);

    // Create simple message
    let message = '';
    if (toolName === 'Bash') {
      const cmd = input.tool_input?.command || '';
      const shortCmd = cmd.length > 50 ? cmd.substring(0, 50) + '...' : cmd;
      message = `Bash: ${shortCmd}`;
    } else if (toolName === 'Task') {
      const desc = input.tool_input?.description || 'task';
      message = `Task: ${desc}`;
    } else if (toolName === 'TaskOutput') {
      message = `TaskOutput: completed`;
    }

    // Send simple notification
    try {
      await fetch(`http://127.0.0.1:${config.worker_port}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'tool',
          title: `${toolName}`,
          message: message,
          project: projectName
        }),
        signal: AbortSignal.timeout(3000)
      });
    } catch {
      // Ignore errors
    }

    outputHookResult({ continue: true });

  } catch (error) {
    outputHookResult({ continue: true });
  }
}

main();
