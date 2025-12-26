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
/plugin install rw-speckit-orchestrator
```

---

## Available Plugins

| Plugin | Version | Description |
|--------|---------|-------------|
| [rw-telegram](./plugins/rw-telegram) | v1.0 | Bidirectional Telegram integration - notifications, questions, and remote control |
| [rw-speckit-orchestrator](./plugins/rw-speckit-orchestrator) | v2.1 | Automated Spec-Kit workflow orchestrator - one feature at a time, full automation |

---

## Plugins

### rw-telegram

Bidirectional Telegram integration for Claude Code:

- **Smart Notifications** - Get notified when Claude completes tasks, needs input, or encounters errors
- **Remote Control** - Send prompts to Claude directly from Telegram
- **Question Forwarding** - Answer Claude's questions from your phone
- **Project Context** - Automatically reads CLAUDE.md before executing tasks
- **Auto-start Worker** - No manual setup required after configuration

```bash
# Setup
/telegram-setup
```

[View Documentation](./plugins/rw-telegram/README.md)

---

### rw-speckit-orchestrator

Automated workflow orchestrator for Spec-Kit driven development:

- **One Feature at a Time** - Complete each feature entirely before moving to next
- **Full Automation** - Auto-answers all prompts, no user intervention needed
- **Resume Support** - Stop and resume from saved state
- **Skip Completed** - Start from any feature with `--start-from`
- **No External Dependencies** - No tmux or watchdog scripts

**Workflow:**
```
Feature 001: specify → clarify → plan → analyze → implement → PR → merge ✓
Feature 002: specify → clarify → plan → analyze → implement → PR → merge ✓
...
```

**Commands:**
```bash
# New project
/setup-speckit
/orchestrate

# Skip to feature 009
/orchestrate --start-from "009"

# Check status
/orch-status

# Stop gracefully
/orch-stop
```

[View Documentation](./plugins/rw-speckit-orchestrator/README.md)

---

## Configuration

### rw-telegram

```bash
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

### rw-speckit-orchestrator

Requires [Spec-Kit CLI](https://github.com/github/spec-kit):

```bash
# Install Spec-Kit CLI
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git

# Verify
specify --version
```

Other requirements:
- jq (for state file parsing)
- gh CLI (for PR creation)

---

## Contributing

Contributions are welcome! Please submit a Pull Request.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Author

**RawinLab** - [github.com/rawinlab](https://github.com/rawinlab)
