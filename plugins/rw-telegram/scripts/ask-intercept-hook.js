#!/usr/bin/env node

/**
 * AskUserQuestion Interception Hook (PostToolUse)
 *
 * This hook intercepts AskUserQuestion tool calls and forwards
 * the questions to Telegram, waiting for a response.
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

    // Check if ask_via_telegram is enabled
    if (!config.ask_via_telegram) {
      outputHookResult({ continue: true });
      return;
    }

    // Get the questions from tool input
    const questions = input.tool_input?.questions;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      outputHookResult({ continue: true });
      return;
    }

    // Send to worker and wait for response
    try {
      const response = await fetch(`http://127.0.0.1:${config.worker_port}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions,
          timeout: 300000 // 5 minutes
        }),
        signal: AbortSignal.timeout(310000) // Slightly longer than question timeout
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 408) {
          // Timeout - let user answer locally
          outputHookResult({
            continue: true,
            systemMessage: 'Telegram response timed out. Please answer the question locally.'
          });
          return;
        }

        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.response) {
        outputHookResult({ continue: true });
        return;
      }

      // Format the answer based on response type
      const { response: userResponse } = data;
      let answerText = '';

      if (userResponse.type === 'cancelled') {
        outputHookResult({
          continue: true,
          systemMessage: 'User cancelled the question from Telegram.'
        });
        return;
      }

      if (userResponse.type === 'text') {
        answerText = userResponse.value;
      } else if (userResponse.type === 'option') {
        answerText = userResponse.value;
      }

      // Return the answer to Claude
      // Note: This modifies how Claude sees the tool result
      outputHookResult({
        continue: true,
        systemMessage: `User responded via Telegram: "${answerText}"`
      });

    } catch (error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        outputHookResult({
          continue: true,
          systemMessage: 'Telegram response timed out. Please answer the question locally.'
        });
        return;
      }

      // Connection error - worker might not be running
      outputHookResult({
        continue: true,
        systemMessage: `Could not reach Telegram worker: ${error.message}. Answering locally.`
      });
    }

  } catch (error) {
    // On error, continue anyway
    outputHookResult({
      continue: true
    });
  }
}

main();
