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
/plugin install rw-kit
```

---

## Available Plugins

| Plugin | Version | Description |
|--------|---------|-------------|
| [rw-telegram](./plugins/rw-telegram) | v1.1 | Bidirectional Telegram with verbose/summary modes, questions, remote control |
| [rw-speckit-orchestrator](./plugins/rw-speckit-orchestrator) | v3.1 | Task Tool based Spec-Kit orchestrator with full testing pipeline |
| [rw-kit](./plugins/rw-kit) | v2.2 | Multi-agent orchestration framework with seed data, user story E2E, and integration testing |

---

## Plugins

### rw-telegram

Bidirectional Telegram integration for Claude Code:

- **Smart Notifications** - Get notified when Claude completes tasks, needs input, or encounters errors
- **Verbose/Summary Modes** - Toggle between all events or important only
- **Remote Control** - Send prompts to Claude directly from Telegram
- **Question Forwarding** - Answer Claude's questions from your phone
- **Project Context** - Automatically reads CLAUDE.md before executing tasks
- **Auto-start Worker** - No manual setup required after configuration

```bash
# Setup
/telegram-setup

# Toggle notification mode
/telegram-verbose on    # All events (formatted nicely)
/telegram-verbose off   # Important only (default)
```

[View Documentation](./plugins/rw-telegram/README.md)

---

### rw-speckit-orchestrator

Automated workflow orchestrator for Spec-Kit driven development using Task Tool:

- **Task Tool Based** - Spawns worker agents for each feature
- **Auto-Answer** - Workers auto-answer ALL prompts (YES/recommended)
- **Context Management** - /context + /compact at every level
- **Retry Support** - Failed workers can be resumed (max 3 times)
- **One Feature at a Time** - Complete before moving to next

**Architecture:**
```
Orchestrator → Task Tool → Worker Agent → Subagents
                              │
                  specify → clarify → plan → analyze → implement
```

**Commands:**
```bash
/orchestrate --start-from "009"
/orch-status
/orch-stop
```

[View Documentation](./plugins/rw-speckit-orchestrator/README.md)

---

### rw-kit

Multi-agent orchestration framework for complete software development lifecycle:

- **6-Phase Workflow** - Clarify → Plan → TodoList → Analyze → Execute → Test/QA
- **5 Custom Agents** - SA-Analyst, Tech Lead, Team Lead, Lead Tester, QA Lead
- **12 Commands** - Full development lifecycle coverage
- **Seed Data Pipeline** - Automatic test database seeding with `TEST_USERS` constants
- **User Story → E2E Mapping** - Every Playwright test traces to a requirement
- **Integration Testing** - Real database tests (no mocking)
- **3-Layer Verification** - Agent output + File existence + State sync
- **Parallel Execution** - Batch-based with context management

**Testing Pipeline:**
```
Seed Data → Unit Tests → Integration Tests → E2E Tests → Smoke Test → Traceability Check
```

**Quick Start:**
```bash
# Full automated workflow (includes seed data + all test levels)
/rw-kit:implement user-authentication feature

# Or step-by-step
/rw-kit:clarify requirements/01-auth.md
/rw-kit:plan-module requirements/01-auth-clarified.md
/rw-kit:execute plans/01-1-auth-todolist.md
```

[View Documentation](./plugins/rw-kit/README.md)

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

### rw-kit

No external dependencies required. State is managed in:
```
.claude/rw-kit.state.json
```

Default tech stack (configurable):
- Frontend: Next.js, Shadcn/ui, Zustand
- Backend: NestJS, REST
- Database: PostgreSQL/MySQL, Prisma
- Unit Testing: Jest (80%+ coverage)
- Integration Testing: Jest + Real DB + Seed Data
- E2E Testing: Playwright (user story-driven, seed data)

---

## Contributing

Contributions are welcome! Please submit a Pull Request.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Author

**RawinLab** - [github.com/rawinlab](https://github.com/rawinlab)
