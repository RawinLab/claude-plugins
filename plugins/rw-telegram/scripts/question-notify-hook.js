#!/usr/bin/env node

/**
 * Question Notification Hook (Simplified)
 *
 * Sends a simple notification when a question is asked.
 * Shows: Question header + available options
 * User answers in Console (not via Telegram)
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

    // Get questions from tool input
    const questions = input.tool_input?.questions;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      outputHookResult({ continue: true });
      return;
    }

    // Get project name
    const projectName = getProjectName(input.cwd);

    // Create simple message with options only
    const q = questions[0]; // Usually just one question
    const header = q.header || 'Question';
    const options = q.options?.map(o => o.label).join(' | ') || '';

    const message = `${header}\nOptions: ${options}`;

    // Send simple notification
    try {
      await fetch(`http://127.0.0.1:${config.worker_port}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'question',
          title: 'Question in Console',
          message: message,
          project: projectName
        }),
        signal: AbortSignal.timeout(5000)
      });
    } catch {
      // Ignore errors
    }

    // Always continue - let Console handle the response
    outputHookResult({ continue: true });

  } catch (error) {
    outputHookResult({ continue: true });
  }
}

main();
