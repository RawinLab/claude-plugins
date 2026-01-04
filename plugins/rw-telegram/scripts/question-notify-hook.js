#!/usr/bin/env node

/**
 * Question Notification Hook (PostToolUse)
 *
 * Sends a notification to Telegram when a question is asked,
 * but does NOT wait for response - user answers in Console.
 */

import { loadConfig, validateConfig } from '../lib/config.mjs';
import { parseHookInput, outputHookResult } from '../lib/utils.mjs';

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

    // Get the questions from tool input
    const questions = input.tool_input?.questions;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      outputHookResult({ continue: true });
      return;
    }

    // Format question summary for notification
    const questionSummary = questions.map((q, i) => {
      const opts = q.options?.map(o => `  • ${o.label}`).join('\n') || '';
      return `❓ ${q.question}\n${opts}`;
    }).join('\n\n');

    // Send notification only (don't wait for response)
    try {
      await fetch(`http://127.0.0.1:${config.worker_port}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'question',
          title: '❓ Question Waiting',
          message: `มีคำถามรออยู่ที่ Console:\n\n${questionSummary}`,
          project: process.cwd().split('/').pop()
        }),
        signal: AbortSignal.timeout(5000)
      });
    } catch (error) {
      // Ignore notification errors - don't block the flow
    }

    // Always continue - let Console handle the response
    outputHookResult({ continue: true });

  } catch (error) {
    outputHookResult({ continue: true });
  }
}

main();
