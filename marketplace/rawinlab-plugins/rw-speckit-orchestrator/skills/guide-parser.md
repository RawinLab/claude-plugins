---
name: guide-parser
description: Parse speckit-guide.md to extract feature list, dependencies, and phases
---

# Guide Parser Skill

This skill helps parse a speckit-guide.md file to extract structured feature information.

## Usage

When you need to parse a speckit-guide.md file, use this skill to understand how to extract:
- Feature IDs and names
- Priority levels
- Dependencies between features
- Phase groupings

## Parsing Patterns

### Feature Headers

Look for these patterns:

```markdown
#### Feature 001: Channel Management
### Feature 001 - Channel Management
## 001: Channel Management
**Feature 001:** Channel Management
```

Extract:
- ID: The number (001, 002, etc.)
- Name: The text after the number

### Priority

Look for:

```markdown
**Priority:** P0 (Critical)
Priority: P1
- Priority: P2 (Medium)
```

Extract: P0, P1, P2, P3

### Dependencies

Look for:

```markdown
**Dependencies:** Feature 001, Feature 002
Depends on: 001
Prerequisites: Channel Management (001)
```

Or in dependency graphs:

```
    F001 → F002 → F003
           ↓
          F004
```

### Phases

Look for:

```markdown
### Phase 1: MVP (Weeks 1-8)
## 5.1 Phase 1: MVP
### Sprint 1-2: Foundation
```

Features listed under a phase heading belong to that phase.

## Output Format

Return a JSON structure:

```json
{
  "project_name": "Project Name",
  "total_features": 15,
  "features": [
    {
      "id": "001",
      "name": "channel-management",
      "priority": "P0",
      "phase": 1,
      "dependencies": []
    },
    {
      "id": "002",
      "name": "research-engine",
      "priority": "P0",
      "phase": 1,
      "dependencies": ["001"]
    }
  ],
  "phases": [
    {
      "number": 1,
      "name": "MVP",
      "feature_ids": ["001", "002", "003", "004", "005", "006"]
    },
    {
      "number": 2,
      "name": "Enhancement",
      "feature_ids": ["007", "008", "009", "010", "011", "012"]
    }
  ]
}
```

## Tips

1. Feature IDs should be zero-padded (001, 002, not 1, 2)
2. Names should be kebab-case for consistency
3. If no priority specified, assume P2
4. If no dependencies specified, assume none
5. If phase unclear, infer from section structure

## Example Parsing

Given:

```markdown
### 5.1 Phase 1: MVP (Weeks 1-8)

#### Feature 001: Channel Management

**Priority:** P0 (Critical)
**User Story:** As a creator, I want to manage channels...

#### Feature 002: Research Engine

**Priority:** P0 (Critical)
**Dependencies:** Feature 001
```

Output:

```json
{
  "features": [
    {
      "id": "001",
      "name": "channel-management",
      "priority": "P0",
      "phase": 1,
      "dependencies": []
    },
    {
      "id": "002",
      "name": "research-engine",
      "priority": "P0",
      "phase": 1,
      "dependencies": ["001"]
    }
  ]
}
```
