#!/usr/bin/env node

/**
 * MCP Server for rw-telegram-claude-plugin
 *
 * Provides tools that Claude can use directly:
 * - telegram_notify: Send notification to Telegram
 * - telegram_ask: Ask user and wait for response
 * - telegram_status: Check worker status
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig, validateConfig, getWorkerPid } from '../lib/config.mjs';

const TOOLS = [
  {
    name: 'telegram_notify',
    description: 'Send a notification message to Telegram. Use this to inform the user about progress, completions, or important events.',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to send to Telegram'
        },
        status: {
          type: 'string',
          enum: ['info', 'success', 'warning', 'error', 'working', 'done'],
          description: 'Status type for emoji prefix (default: info)'
        }
      },
      required: ['message']
    }
  },
  {
    name: 'telegram_ask',
    description: 'Ask the user a question via Telegram and wait for their response. Use this when you need input from the user and they prefer to respond via Telegram.',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask the user'
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of choices for the user to pick from'
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 300000 = 5 minutes)'
        }
      },
      required: ['question']
    }
  },
  {
    name: 'telegram_status',
    description: 'Check the status of the Telegram worker and connection.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

async function callWorkerApi(config, endpoint, method = 'GET', body = null) {
  const url = `http://127.0.0.1:${config.worker_port}${endpoint}`;

  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(310000)
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  return response.json();
}

async function handleToolCall(name, args) {
  const config = loadConfig();
  const validation = validateConfig();

  if (!validation.valid) {
    return {
      content: [{
        type: 'text',
        text: `Telegram plugin not configured. Errors: ${validation.errors.join(', ')}. Run /telegram-setup to configure.`
      }],
      isError: true
    };
  }

  const workerPid = getWorkerPid();
  if (!workerPid) {
    return {
      content: [{
        type: 'text',
        text: 'Telegram worker is not running. Start it with: node scripts/worker-cli.js start'
      }],
      isError: true
    };
  }

  switch (name) {
    case 'telegram_notify': {
      try {
        await callWorkerApi(config, '/api/notify', 'POST', {
          message: args.message,
          status: args.status || 'info'
        });

        return {
          content: [{
            type: 'text',
            text: 'Notification sent to Telegram successfully.'
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Failed to send notification: ${error.message}`
          }],
          isError: true
        };
      }
    }

    case 'telegram_ask': {
      try {
        // Format question as the worker expects
        const questions = [{
          question: args.question,
          options: args.options?.map(label => ({ label })) || []
        }];

        const result = await callWorkerApi(config, '/api/ask', 'POST', {
          questions,
          timeout: args.timeout || 300000
        });

        if (result.error === 'timeout') {
          return {
            content: [{
              type: 'text',
              text: 'User did not respond within the timeout period.'
            }]
          };
        }

        if (result.response?.type === 'cancelled') {
          return {
            content: [{
              type: 'text',
              text: 'User cancelled the question.'
            }]
          };
        }

        return {
          content: [{
            type: 'text',
            text: `User responded: ${result.response?.value || 'No response'}`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Failed to ask user: ${error.message}`
          }],
          isError: true
        };
      }
    }

    case 'telegram_status': {
      try {
        const health = await callWorkerApi(config, '/health');

        return {
          content: [{
            type: 'text',
            text: [
              'Telegram Worker Status:',
              `- Status: Running (PID: ${workerPid})`,
              `- Uptime: ${Math.round(health.uptime || 0)} seconds`,
              `- Port: ${config.worker_port}`,
              `- Chat ID: ${config.chat_id}`
            ].join('\n')
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Worker status check failed: ${error.message}`
          }],
          isError: true
        };
      }
    }

    default:
      return {
        content: [{
          type: 'text',
          text: `Unknown tool: ${name}`
        }],
        isError: true
      };
  }
}

async function main() {
  const server = new Server(
    {
      name: 'rw-telegram',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args || {});
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
