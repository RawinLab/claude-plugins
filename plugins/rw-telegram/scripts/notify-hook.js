#!/usr/bin/env node

/**
 * Smart Notification Hook
 *
 * Supports multiple notification types like claude-notifications-go:
 * - stop: Task complete or paused
 * - end: Session ended
 * - plan_ready: Plan ready for approval (ExitPlanMode)
 * - question: Question asked (AskUserQuestion)
 * - review: Review complete
 * - limit: Session limit reached
 * - error: API error
 */

import path from 'node:path';
import fs from 'node:fs';
import { loadConfig, validateConfig } from '../lib/config.mjs';
import { parseHookInput, outputHookResult, getProjectName, truncate } from '../lib/utils.mjs';

// Notification type configurations
const NOTIFICATION_TYPES = {
  stop: {
    emoji: '✅',
    title: 'Task Complete',
    analyze: true
  },
  end: {
    emoji: '🏁',
    title: 'Session Ended'
  },
  plan_ready: {
    emoji: '📋',
    title: 'Plan Ready',
    description: 'Claude has a plan ready for your approval'
  },
  question: {
    emoji: '❓',
    title: 'Question'
  },
  review: {
    emoji: '🔍',
    title: 'Review Complete'
  },
  limit: {
    emoji: '⏱️',
    title: 'Session Limit Reached'
  },
  error: {
    emoji: '🔴',
    title: 'API Error'
  }
};

/**
 * Parse Claude's categorization from prompt hook result
 * Claude outputs JSON like: {"category": "stop", "summary": "..."}
 */
function parseClaudeAnalysis(hookResult) {
  if (!hookResult) {
    return null;
  }

  try {
    // The prompt hook result might be in different formats
    // Try to extract JSON from the result
    const jsonMatch = hookResult.match(/\{[\s\S]*"category"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.category) {
        return {
          type: parsed.category,
          details: parsed.summary || parsed.reason || null
        };
      }
    }
  } catch {
    // Failed to parse Claude's response
  }

  return null;
}

/**
 * Fallback: Analyze transcript to determine notification type
 * Only used if Claude's analysis is not available
 */
function analyzeTranscript(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return { type: 'stop', details: null };
  }

  try {
    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());

    // Get last 15 messages for analysis
    const recentLines = lines.slice(-15);
    const recentText = recentLines.join('\n').toLowerCase();

    // Check for session limit - these are system messages, unlikely false positive
    if (recentText.includes('context limit') ||
        recentText.includes('token limit') ||
        recentText.includes('conversation too long')) {
      return { type: 'limit', details: 'Context limit reached' };
    }

    // For API errors - be more conservative, only match actual error responses
    // Don't match when Claude is discussing or fixing errors
    const errorPatterns = [
      /api.*returned.*error/i,
      /authentication failed/i,
      /rate limit exceeded/i,
      /service unavailable/i
    ];

    // Check if error appears in tool output context (actual error)
    // vs in discussion context (talking about errors)
    const hasActualError = errorPatterns.some(p => p.test(recentText)) &&
      (recentText.includes('tool_result') || recentText.includes('error_code'));

    if (hasActualError) {
      return { type: 'error', details: 'API error' };
    }

    // Check for review (read-only operations in tools used)
    const readOnlyPatterns = ['read', 'grep', 'glob'];
    const writePatterns = ['write', 'edit', 'bash'];

    const hasReadOnly = readOnlyPatterns.some(p => recentText.includes(`tool.*${p}`));
    const hasWrite = writePatterns.some(p => recentText.includes(`tool.*${p}`));

    if (hasReadOnly && !hasWrite) {
      return { type: 'review', details: 'Read-only analysis completed' };
    }

    // Extract last few lines for summary
    const lastLines = lines.slice(-3).join('\n');
    return { type: 'stop', details: truncate(lastLines, 200) };

  } catch {
    return { type: 'stop', details: null };
  }
}

async function main() {
  const eventType = process.argv[2]; // 'stop', 'end', 'plan_ready', etc.

  try {
    const input = await parseHookInput();
    const config = loadConfig();

    // Check if config is valid
    const validation = validateConfig();
    if (!validation.valid) {
      outputHookResult({ continue: true });
      return;
    }

    // Check if notifications are enabled
    if (eventType === 'stop' && !config.notifications?.on_stop) {
      outputHookResult({ continue: true });
      return;
    }

    if (eventType === 'end' && !config.notifications?.on_session_end) {
      outputHookResult({ continue: true });
      return;
    }

    // Get project name
    const projectName = getProjectName(input.cwd);

    // Determine notification type and message
    let notifType = eventType;
    let details = null;

    // For stop events, try Claude's analysis first, then fallback
    if (eventType === 'stop') {
      // Try to get Claude's analysis from previous prompt hook
      const claudeAnalysis = parseClaudeAnalysis(input.hook_result || input.previous_hook_result);

      if (claudeAnalysis) {
        // Use Claude's intelligent categorization
        notifType = claudeAnalysis.type;
        details = claudeAnalysis.details;
      } else {
        // Fallback to transcript analysis
        const analysis = analyzeTranscript(input.transcript_path);
        notifType = analysis.type;
        details = analysis.details;
      }
    }

    // Get notification config
    const notifConfig = NOTIFICATION_TYPES[notifType] || NOTIFICATION_TYPES.stop;

    // Build message
    let message = `${notifConfig.emoji} *${notifConfig.title}*\n\n`;
    message += `📁 Project: \`${projectName}\``;
    message += `\n📂 Path: \`${input.cwd || 'unknown'}\``;

    if (notifConfig.description) {
      message += `\n\n${notifConfig.description}`;
    }

    if (details) {
      message += `\n\n\`\`\`\n${details}\n\`\`\``;
    }

    // Send notification to worker
    try {
      await fetch(`http://127.0.0.1:${config.worker_port}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          status: notifType,
          project: projectName
        }),
        signal: AbortSignal.timeout(5000)
      });
    } catch {
      // Ignore notification errors
    }

    // Update session info for 'end' event
    if (eventType === 'end') {
      try {
        await fetch(`http://127.0.0.1:${config.worker_port}/api/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: false }),
          signal: AbortSignal.timeout(5000)
        });
      } catch {
        // Ignore
      }
    }

    outputHookResult({ continue: true });

  } catch (error) {
    // On error, continue anyway
    outputHookResult({ continue: true });
  }
}

main();
