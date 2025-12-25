# RawinLab Claude Plugins

> A collection of Claude Code plugins by RawinLab

[![Claude Code](https://img.shields.io/badge/Claude%20Code-Plugins-blue.svg)](https://claude.ai/code)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Quick Install

```bash
# Add the marketplace
/plugin marketplace add rawinlab/claude-plugins

# Install any plugin
/plugin install rw-telegram
```

---

## Available Plugins

| Plugin | Description | Status |
|--------|-------------|--------|
| [rw-telegram](./plugins/rw-telegram) | Bidirectional Telegram integration - notifications, questions, and remote control | ✅ Stable |

---

## Plugins

### rw-telegram

Bidirectional Telegram integration for Claude Code:

- **Smart Notifications** - Get notified when Claude completes tasks, needs input, or encounters errors
- **Remote Control** - Send prompts to Claude directly from Telegram
- **Question Forwarding** - Answer Claude's questions from your phone
- **Project Context** - Automatically reads CLAUDE.md before executing tasks
- **Auto-start Worker** - No manual setup required after configuration

[View Documentation](./plugins/rw-telegram/README.md)

---

## Configuration

Each plugin has its own configuration. See individual plugin documentation for details.

### rw-telegram Configuration

```bash
# Create config
mkdir -p ~/.claude-telegram

cat > ~/.claude-telegram/config.json << 'EOF'
{
  "bot_token": "YOUR_BOT_TOKEN",
  "chat_id": "YOUR_CHAT_ID",
  "allowed_user_ids": [YOUR_USER_ID],
  "worker_port": 37778
}
EOF

chmod 600 ~/.claude-telegram/config.json
```

---

## Upcoming Plugins

- **rw-memory** - Enhanced session memory and context management
- **rw-dashboard** - Web dashboard for monitoring Claude sessions

---

## Contributing

Contributions are welcome! Please submit a Pull Request.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Author

**RawinLab** - [github.com/rawinlab](https://github.com/rawinlab)
