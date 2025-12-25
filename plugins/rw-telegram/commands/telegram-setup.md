---
name: telegram-setup
description: Configure Telegram bot for Claude Code notifications and bidirectional communication
---

# Telegram Setup Command

You are setting up the rw-telegram-claude-plugin for the user. This plugin enables:
- Notifications when Claude stops or finishes work
- Forwarding questions to Telegram and waiting for responses
- Remote commands from Telegram

## Setup Process

### Step 1: Get Bot Token

First, check if the user already has a Telegram bot token.

Use AskUserQuestion to ask:
- Question: "Do you have a Telegram Bot Token?"
- Options:
  1. "Yes, I have one" - Proceed to enter token
  2. "No, I need to create one" - Show instructions

If they need to create one, explain:
```
To create a Telegram bot:
1. Open Telegram and search for @BotFather
2. Send /newbot command
3. Follow the prompts to name your bot
4. Copy the token that looks like: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### Step 2: Enter Bot Token

Use AskUserQuestion to ask for the bot token. The user should paste their token.

After receiving the token, validate it by making a test API call:
```bash
curl -s "https://api.telegram.org/bot<TOKEN>/getMe"
```

If valid, you'll get a response with the bot info.

### Step 3: Get Chat ID

Use AskUserQuestion to ask:
- Question: "Do you know your Telegram Chat ID?"
- Options:
  1. "Yes" - Proceed to enter ID
  2. "No, how do I find it?" - Show instructions

If they need help:
```
To find your Chat ID:
1. Search for @userinfobot on Telegram
2. Start a chat with it
3. It will reply with your ID (a number like 123456789)
```

### Step 4: Save Configuration

After collecting both values, save the configuration:

```bash
# Create config directory
mkdir -p ~/.claude-telegram

# Save config
cat > ~/.claude-telegram/config.json << 'EOF'
{
  "bot_token": "<USER_TOKEN>",
  "chat_id": "<USER_CHAT_ID>",
  "allowed_user_ids": [<USER_CHAT_ID>],
  "worker_port": 37778,
  "notifications": {
    "on_stop": true,
    "on_session_end": true,
    "on_error": true
  },
  "ask_via_telegram": true
}
EOF

# Set secure permissions
chmod 600 ~/.claude-telegram/config.json
```

### Step 5: Test Connection

Send a test message to verify everything works:

```bash
curl -s -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "<CHAT_ID>",
    "text": "✅ *Claude Code Connected!*\n\nYour Telegram integration is now set up. You will receive notifications here.",
    "parse_mode": "Markdown"
  }'
```

### Step 6: Start Worker

Start the background worker that handles Telegram polling:

```bash
# Navigate to plugin directory
cd "${CLAUDE_PLUGIN_ROOT}"

# Start worker
node scripts/worker-cli.js start
```

### Step 7: Confirm Setup

Tell the user:
```
Setup complete! The plugin is now configured.

What happens next:
- When Claude stops working, you'll get a notification
- When Claude asks questions (AskUserQuestion), they'll be forwarded to Telegram
- You can respond via Telegram and Claude will receive your answer

Telegram commands:
- /status - Check Claude's status
- /help - Show available commands

Note: You may need to restart Claude Code to activate the hooks.
```

## Troubleshooting

If something goes wrong:
1. Check if the bot token is valid
2. Make sure the Chat ID is correct
3. Verify the worker is running: `node scripts/worker-cli.js status`
4. Check logs: `cat ~/.claude-telegram/worker.log`
