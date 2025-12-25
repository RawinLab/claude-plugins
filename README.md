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
| [rw-speckit-orchestrator](./plugins/rw-speckit-orchestrator) | Automated workflow orchestrator for Spec-Kit driven development with parallel workers | ✅ Stable |

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

### rw-speckit-orchestrator

Automated workflow orchestrator for Spec-Kit driven development:

- **Parallel Workers** - Run multiple Claude Code agents simultaneously (1-8 workers)
- **Real-time Dashboard** - Monitor progress via tmux
- **Auto-Answer** - Automatically answer clarify/analyze questions with recommended options
- **Guaranteed Completion** - Watchdog ensures all features are implemented
- **Resume Support** - Stop and resume from saved state
- **Import Progress** - Start from existing manually-completed features

**Commands:**
- `/setup-speckit` - Interactive wizard to create speckit-guide.md
- `/orchestrate` - Start parallel implementation of all features
- `/orch-status` - Check orchestration progress
- `/orch-stop` - Gracefully stop orchestration

[View Documentation](./plugins/rw-speckit-orchestrator/README.md)

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

### rw-speckit-orchestrator Configuration

Requires [Spec-Kit CLI](https://github.com/github/spec-kit) to be installed:

```bash
# Install Spec-Kit CLI
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

# Verify installation
specify --version
```

Other requirements:
- tmux
- jq (for state file parsing)

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
