# rw-telegram-claude-plugin

> Bidirectional Telegram integration for Claude Code - Get notifications, answer questions, and control Claude remotely from your phone.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Plugin-blue.svg)](https://claude.ai/code)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

This plugin transforms your Telegram into a powerful remote control for Claude Code. Whether you're away from your desk or just want notifications on your phone, this plugin has you covered.

### Key Features

| Feature | Description |
|---------|-------------|
| **Smart Notifications** | Get notified when Claude completes tasks, needs input, or encounters errors |
| **Verbose/Summary Modes** | Toggle between all events (verbose) or important only (summary) |
| **Remote Control** | Send prompts to Claude directly from Telegram |
| **Question Forwarding** | Answer Claude's questions from your phone |
| **Project Context** | Automatically reads CLAUDE.md before executing tasks |
| **Transcript Analysis** | Intelligently detects task completion vs review vs errors |

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Code                               │
├─────────────────────────────────────────────────────────────────┤
│  Hooks (Auto-trigger)           │  MCP Tools (Manual)           │
│  ├─ SessionStart                │  ├─ telegram_notify           │
│  ├─ Stop → Smart Detection      │  ├─ telegram_ask              │
│  ├─ SessionEnd                  │  └─ telegram_status           │
│  ├─ ExitPlanMode (Plan Ready)   │                               │
│  └─ AskUserQuestion             │                               │
└────────────────┬────────────────┴───────────────┬───────────────┘
                 │ HTTP API (localhost:37778)     │
                 ▼                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Background Worker (Node.js)                    │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Telegram   │  │   HTTP API  │  │  tmux Integration       │  │
│  │  Polling    │  │   Server    │  │  (Claude Control)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                 │
                 ▼ Telegram Bot API
┌─────────────────────────────────────────────────────────────────┐
│                     📱 Your Telegram                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Smart Notification Types

Inspired by [claude-notifications-go](https://github.com/777genius/claude-notifications-go), this plugin uses intelligent transcript analysis to determine the right notification type:

| Emoji | Type | Trigger |
|-------|------|---------|
| ✅ | **Task Complete** | Claude finished editing files or running commands |
| 🔍 | **Review Complete** | Claude finished read-only analysis (no file changes) |
| 📋 | **Plan Ready** | Claude has a plan waiting for your approval |
| ❓ | **Question** | Claude needs your input to continue |
| ⏱️ | **Session Limit** | Context limit reached |
| 🔴 | **API Error** | Authentication or API errors |
| 🏁 | **Session Ended** | Claude session closed |

### Example Notifications

```
✅ Task Complete

📁 Project: `my-awesome-project`
📂 Path: `/home/dev/projects/my-awesome-project`

Fixed authentication bug in login.js

25/12/2568, 22:30:45
```

```
📋 Plan Ready

📁 Project: `my-awesome-project`
📂 Path: `/home/dev/projects/my-awesome-project`

Claude has a plan ready for your approval

25/12/2568, 22:31:20
```

---

## Installation

### Quick Install (Recommended)

```bash
# In Claude Code, run:
/plugin marketplace add rawinlab/rw-telegram-claude-plugin
/plugin install rw-telegram-claude-plugin
```

Then restart Claude Code. The worker will **auto-start** when you begin a new session.

### Manual Install

#### Prerequisites

- Node.js 18+
- Claude Code installed
- Telegram account
- tmux (for remote control feature)

#### Step 1: Clone or Download

```bash
# Clone to your projects folder
git clone https://github.com/rawinlab/rw-telegram-claude-plugin.git
cd rw-telegram-claude-plugin

# Install dependencies
npm install
```

#### Step 2: Create Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts
3. Save the **Bot Token** (looks like `123456789:ABCdefGHI...`)

#### Step 3: Get Your Chat ID

1. Search for **@userinfobot** on Telegram
2. Start a chat - it will reply with your **Chat ID** (a number like `1510291963`)

#### Step 4: Configure

```bash
# Create config directory
mkdir -p ~/.claude-telegram

# Create config file
cat > ~/.claude-telegram/config.json << 'EOF'
{
  "bot_token": "YOUR_BOT_TOKEN_HERE",
  "chat_id": "YOUR_CHAT_ID_HERE",
  "allowed_user_ids": [YOUR_CHAT_ID_AS_NUMBER],
  "worker_port": 37778,
  "workdir": "/home/dev/projects",
  "tmux_session": "claude-telegram",
  "claude_cmd": "claude --dangerously-skip-permissions",
  "notifications": {
    "on_stop": true,
    "on_session_end": true,
    "on_error": true
  },
  "ask_via_telegram": true
}
EOF

# Secure the config file
chmod 600 ~/.claude-telegram/config.json
```

#### Step 5: Link Plugin to Claude Code

```bash
# Create plugins directory if not exists
mkdir -p ~/.claude/plugins/local

# Symlink the plugin
ln -sf /path/to/rw-telegram-claude-plugin ~/.claude/plugins/local/rw-telegram-claude-plugin
```

#### Step 6: Restart Claude Code

Restart Claude Code to activate the hooks. The worker will **auto-start** when you begin a new session. You should receive a notification on Telegram!

> **Note:** You can also manually manage the worker with `npm run worker:start|stop|status`

---

## Notification Modes

Toggle between two modes using `/verbose` command in Telegram or `/telegram-verbose` in Claude:

### Summary Mode (Default)

Only important events are sent:
- ✅ Task Complete
- ❌ Errors
- ❓ Questions from Claude
- 📋 Plan Ready
- 🏁 Session End

### Verbose Mode

All tool events are sent (formatted nicely):
- 🔨 Bash commands and results
- 📝 File edits
- ✍️ File writes
- 📖 File reads
- 🤖 Agent spawns

```
📢 Verbose Mode Examples:

🔨 *Bash*
`npm test`
→ ✅ 15 tests passed

📝 *Edit*: user.ts
Added login validation

🤖 *Task*
Agent: test-automator
📝 Write tests for auth module
```

### Toggle Commands

```bash
# In Claude Code:
/telegram-verbose on     # Enable verbose
/telegram-verbose off    # Enable summary (default)
/telegram-verbose status # Check current mode

# In Telegram:
/verbose on
/verbose off
/verbose          # Show status
```

---

## Telegram Commands

### Session Management

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/status` | Show current status (sessions, workdir, pending questions) |
| `/cancel` | Cancel all pending questions |
| `/verbose` | Toggle notification mode (verbose/summary) |

### Claude Control (via tmux)

| Command | Description |
|---------|-------------|
| `/cd <path>` | Set working directory for Claude |
| `/send <prompt>` | Send a prompt to Claude (auto-reads CLAUDE.md) |
| `/tmux_start` | Start Claude in a tmux session |
| `/tmux_stop` | Stop the tmux session |
| `/tmux_tail [n]` | Show last n lines of output (default: 50) |

### Usage Examples

```
# Set the project directory
/cd /home/dev/projects/my-api

# Send a task to Claude
/send Fix the bug in user authentication

# Check what Claude is doing
/tmux_tail 100

# Stop Claude if needed
/tmux_stop
```

When you use `/send`, Claude will:
1. Read `CLAUDE.md` in the project directory (if exists)
2. Understand the project context
3. Execute your task

---

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `bot_token` | string | *required* | Telegram bot token from @BotFather |
| `chat_id` | string | *required* | Your Telegram chat ID |
| `allowed_user_ids` | number[] | `[]` | Whitelist of allowed user IDs (empty = all allowed) |
| `worker_port` | number | `37778` | HTTP API port for worker |
| `workdir` | string | `process.cwd()` | Default working directory |
| `tmux_session` | string | `claude-telegram` | tmux session name |
| `claude_cmd` | string | `claude --dangerously-skip-permissions` | Command to start Claude |
| `notifications.on_stop` | boolean | `true` | Notify when Claude stops |
| `notifications.on_session_end` | boolean | `true` | Notify when session ends |
| `notifications.on_error` | boolean | `true` | Notify on errors |
| `ask_via_telegram` | boolean | `true` | Forward questions to Telegram |
| `verbose_mode` | boolean | `false` | Send all tool events (true) or summary only (false) |

---

## Worker Management

The worker **auto-starts** when you begin a Claude Code session (via SessionStart hook). You can also manage it manually:

```bash
# Check status
npm run worker:status

# Stop worker
npm run worker:stop

# Restart worker
npm run worker:restart

# View logs
npm run worker:logs
```

Or use the CLI directly:

```bash
node scripts/worker-cli.js status
node scripts/worker-cli.js stop
node scripts/worker-cli.js logs 100
```

---

## MCP Tools

Claude can use these tools directly in conversations:

### telegram_notify

Send a notification to Telegram.

```
Use telegram_notify to tell the user "Build completed successfully"
```

### telegram_ask

Ask the user a question and wait for response.

```
Use telegram_ask to ask "Which database should I use?" with options ["PostgreSQL", "MySQL", "MongoDB"]
```

### telegram_status

Check worker status.

```
Use telegram_status to check if Telegram integration is working
```

---

## Hook Events

The plugin listens to these Claude Code events:

| Hook | Event | Action |
|------|-------|--------|
| `SessionStart` | Claude session starts | Start worker if not running, update session info |
| `PreToolUse[ExitPlanMode]` | Plan ready for approval | Send "Plan Ready" notification |
| `PostToolUse[AskUserQuestion]` | Claude asks question | Forward to Telegram, wait for response |
| `Stop` | Claude stops | Analyze transcript, send smart notification |
| `SessionEnd` | Session ends | Send "Session Ended" notification |

---

## Project Structure

```
rw-telegram-claude-plugin/
├── .claude-plugin/
│   └── plugin.json           # Plugin metadata
├── .mcp.json                  # MCP server configuration
├── hooks/
│   └── hooks.json            # Hook definitions
├── scripts/
│   ├── worker.mjs            # Background worker (Telegram polling + HTTP API)
│   ├── worker-cli.js         # Worker management CLI
│   ├── mcp-server.mjs        # MCP server for Claude tools
│   ├── ensure-worker.js      # SessionStart hook
│   ├── notify-hook.js        # Smart notification hook
│   ├── tool-notify-hook.js   # Tool event notification hook (verbose mode)
│   ├── toggle-verbose.js     # Verbose mode toggle script
│   └── ask-intercept-hook.js # Question forwarding hook
├── commands/
│   ├── telegram-setup.md     # Setup command for Claude
│   └── telegram-verbose.md   # Verbose mode toggle command
├── lib/
│   ├── config.mjs            # Configuration management
│   ├── telegram-api.mjs      # Telegram Bot API wrapper
│   ├── formatter.mjs         # Message formatting for notifications
│   └── utils.mjs             # Shared utilities
├── package.json
└── README.md
```

---

## Troubleshooting

### Worker not starting

```bash
# Check if port is in use
lsof -i :37778

# Check logs
cat ~/.claude-telegram/worker.log

# Verify config
cat ~/.claude-telegram/config.json
```

### Not receiving notifications

1. Make sure you started a chat with your bot on Telegram first
2. Verify bot token is correct:
   ```bash
   curl "https://api.telegram.org/bot<YOUR_TOKEN>/getMe"
   ```
3. Verify chat ID is correct
4. Check worker is running: `npm run worker:status`

### Questions not forwarding

1. Ensure `ask_via_telegram` is `true` in config
2. Restart Claude Code to reload hooks
3. Check worker logs for errors

### tmux commands not working

1. Install tmux: `sudo apt install tmux` or `brew install tmux`
2. Check tmux is available: `which tmux`
3. Set correct workdir with `/cd <path>`

---

## Security Considerations

1. **Token Security**: Config file is stored with `600` permissions (owner read/write only)
2. **User Whitelist**: Only users in `allowed_user_ids` can use the bot
3. **Local Only**: HTTP API only listens on `127.0.0.1`
4. **No Secrets in Logs**: Bot token is not logged

---

## Comparison with claude-notifications-go

| Feature | claude-notifications-go | rw-telegram-claude-plugin |
|---------|------------------------|---------------------------|
| Desktop Notifications | ✅ | ❌ |
| Telegram Notifications | ✅ | ✅ |
| Smart Detection (6 types) | ✅ | ✅ |
| Transcript Analysis | ✅ | ✅ |
| **Answer Questions via Telegram** | ❌ | ✅ |
| **Remote Control (send prompts)** | ❌ | ✅ |
| **Auto-read CLAUDE.md** | ❌ | ✅ |
| Cross-platform Binary | ✅ | ❌ (Node.js) |
| Language | Go | JavaScript/Node.js |

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Author

**RawinLab**

---

## Acknowledgments

- Inspired by [claude-notifications-go](https://github.com/777genius/claude-notifications-go)
- Built for [Claude Code](https://claude.ai/code) by Anthropic
