---
name: telegram-verbose
description: Toggle Telegram notification verbose mode
arguments:
  - name: mode
    description: "on, off, or status"
    required: false
---

# Telegram Verbose Mode Toggle

Toggle between verbose mode (all events) and summary mode (important events only).

```bash
# Check current mode
node "${CLAUDE_PLUGIN_ROOT}/scripts/toggle-verbose.js" status

# Set mode based on argument
node "${CLAUDE_PLUGIN_ROOT}/scripts/toggle-verbose.js" $ARGUMENTS
```

## Modes

- **Verbose (on)**: Send all tool events formatted nicely
  - Every Bash command and result
  - Every file read/write/edit
  - Every agent spawn
  - Plus all summary events

- **Summary (off)**: Send only important events
  - Task complete
  - Errors
  - Questions from Claude
  - Plan ready
  - Session end
