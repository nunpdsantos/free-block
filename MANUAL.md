# Starter Template — Manual

## What This Is

A ready-to-go project template for Claude Code. Copy it to start new projects or graft it onto existing ones. Everything is pre-wired: session orientation, commit conventions, behavioral reinforcement, and safety hooks.

**Prerequisites:** Some features in this template depend on plugins and global hooks that live outside the starter folder. See `~/Desktop/claude-code-system-guide.md` for the full setup — plugins, global hooks, and how everything connects.

---

## Quick Start

### New project

```bash
cp -r ~/Desktop/starter ~/path/to/my-new-project
cd ~/path/to/my-new-project
git init
claude
# Then: /bootstrap my project idea
```

`/bootstrap` researches your domain, plans the architecture, configures quality-gate hooks, and populates CLAUDE.md — all with your approval before building anything.

### Existing project

```bash
cp -r ~/Desktop/starter/.claude ~/path/to/existing-project/
# Merge .gitignore manually — don't overwrite yours:
cat ~/Desktop/starter/.gitignore >> ~/path/to/existing-project/.gitignore
cd ~/path/to/existing-project
claude
```

The SessionStart hook auto-orients Claude with your git state. Fill in CLAUDE.md yourself, or run `/revise-claude-md` at the end of your first session to capture what Claude learned.

---

## What's Inside

```
starter/
├── CLAUDE.md                                        # Project context (you fill this in)
├── MANUAL.md                                        # This file
├── .gitignore                                       # Pre-configured for Claude + credentials
├── .claude/
│   ├── settings.json                                # SessionStart hook registration
│   ├── hooks/
│   │   └── session-start.sh                         # Git context auto-injection
│   ├── rules/
│   │   └── commits.md                               # Conventional commits format
│   ├── skills/
│   │   ├── bootstrap/SKILL.md                       # New project setup wizard
│   │   └── agent-behavior/SKILL.md                  # Behavioral reload (emergency fallback)
│   └── hookify.behavioral-reinforcement.local.md    # Per-project behavioral backup
```

---

## File by File

### CLAUDE.md

The project's brain. Claude reads this at session start. Everything here shapes every response.

**Rules for editing it:**
- Every line must pass: "Would removing this cause Claude to make a mistake?"
- Only document what Claude can't figure out by reading your code
- Target under 50 lines after initial setup
- Use `<!-- comments -->` as section prompts — they remind you what belongs where

**Sections:**
| Section | What goes here |
|---|---|
| **Project** | Name and stack — the basics |
| **Commands** | Only non-obvious ones. If `npm run dev` works, don't list it |
| **Architecture** | Only deviations from convention. Tell Claude WHERE to look, not WHAT's there |
| **Gotchas** | Environment quirks, non-obvious behaviors, things that would trip Claude up |

### .claude/settings.json

Registers the SessionStart hook. This is the **project-level** settings file — it merges with your global `~/.claude/settings.json`, not replaces it.

You can add more hooks here as your project grows. Example: a typecheck hook that runs after every file edit, or a test hook that runs before Claude stops working.

### .claude/hooks/session-start.sh

Fires automatically on every `startup` and `resume`. Gathers:
- Current branch name
- Count of staged/unstaged/untracked files
- Last 5 commit messages
- Stash count
- Open PR for the current branch (if `gh` CLI is available)

This context gets injected as `additionalContext` — Claude sees it before responding to your first message. No manual orientation needed.

### .claude/rules/commits.md

Loaded automatically on every session. Enforces:
- **Conventional commits**: `type(scope): description`
- **Types**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`, `ci`, `build`, `revert`
- Focus on WHY, not WHAT
- Never amend, push, or skip hooks unless you explicitly ask
- Stage specific files — never `git add -A`

This replaces a 51-line commit skill with 5 lines. The `.claude/rules/` directory is Claude Code's native rules system — every `.md` file in it is loaded into context automatically.

### .claude/skills/bootstrap/SKILL.md

Run with `/bootstrap [idea]`. Only needed once per project.

What it does:
1. Takes your project idea
2. Researches current state of the art for the domain
3. Plans architecture, identifies needed hooks/rules/agents
4. Presents the plan for your approval
5. Builds everything after you approve
6. Populates CLAUDE.md with only what Claude needs to know

It also proposes quality-gate hooks (typecheck, lint, test) as defaults — you opt out, not in.

### .claude/skills/agent-behavior/SKILL.md

Run with `/agent-behavior`. Emergency fallback — you shouldn't need it.

Over long conversations, Claude drifts toward agreeability and soft language. The global behavioral reinforcement hook (see below) prevents this automatically. But if you notice drift despite the hook, `/agent-behavior` does a heavy reload: ~500 tokens of behavioral rules injected at high proximity to current context.

**When to use it:** When Claude starts saying "Great question!" or "Perhaps we could consider..." or agreeing without conviction. If you never need it, the hook system is working.

### .claude/hookify.behavioral-reinforcement.local.md

A hookify rule that fires on every prompt. Backup for the global behavioral reinforcement hook.

Requires the `hookify` plugin to be installed. The `.local.md` suffix means it's gitignored — personal preference, not shared with the team.

### .gitignore

Pre-configured to exclude:
- `.claude/*.local.*` and `settings.local.json` — personal Claude settings
- `.env` files (except `.env.example`)
- Private keys, credentials, secrets files
- OS junk (`.DS_Store`, `Thumbs.db`)
- Commented-out dependency dirs — uncomment the line for your stack

---

## The Global Layer

The starter template is the **project layer**. It works alongside a **global layer** in `~/.claude/` that protects every project automatically.

### What runs globally (you don't configure this per-project)

| Hook | Trigger | What it does |
|---|---|---|
| **behavioral-reinforcement** | Every prompt you send | Injects ~25 tokens: "zero agreeability, no softening, no verbosity, challenge the ask, maximum model capability." Counteracts RLHF drift. |
| **git-guard** | Every Bash command | Blocks destructive git ops: `push --force`, `reset --hard`, `clean -f`, `branch -D`, `checkout .`, `stash drop`, `rebase -i`. Returns a structured deny with reason. |
| **detect-secrets** | Every file Edit/Write | Scans for AWS keys, GitHub tokens, Stripe keys, PEM files, JWTs, connection strings, and generic `api_key=`/`password=` patterns. Blocks before content reaches disk. |

These live in `~/.claude/hooks/` and are registered in `~/.claude/settings.json`. They apply to ALL projects regardless of whether you use this starter template.

### The full session lifecycle

| Phase | What fires | Automatic? |
|---|---|---|
| Session start | SessionStart hook → git context injection | Yes |
| Every message | Global behavioral reinforcement hook | Yes |
| Every file edit | Global detect-secrets + security-guidance plugin (if installed) | Yes |
| Every Bash command | Global git-guard | Yes |
| Every commit | `.claude/rules/commits.md` conventional format | Yes |
| Behavioral drift | `/agent-behavior` manual reload | Manual (fallback) |
| First session | `/bootstrap [idea]` | Manual (one-time) |
| Session end | `/revise-claude-md` to capture learnings | Manual (recommended) |

---

## Customizing Your Project

### Adding rules

Create `.md` files in `.claude/rules/`. They load automatically.

```markdown
<!-- .claude/rules/testing.md -->
## Testing
Run `npm test` before marking any task complete.
Never mock database calls — use the test database at localhost:5433.
```

You can scope rules to specific paths with frontmatter:

```markdown
---
paths:
  - src/api/**
---
## API conventions
All endpoints return `{ data, error, meta }` shape.
```

### Adding hookify rules

Requires the `hookify` plugin. Create `.claude/hookify.*.local.md` files for custom guardrails, or use the `/hookify` command:

```
/hookify Don't use rm -rf without asking me first
/hookify Block any console.log statements in my code
/hookify Warn me before touching .env or credentials files
```

Run `/hookify` with no arguments after a frustrating session — it analyzes the conversation and proposes rules to prevent recurring mistakes.

Manage rules with:
- `/hookify:list` — see all rules and their status
- `/hookify:configure` — enable/disable rules interactively

### Adding quality-gate hooks

Edit `.claude/settings.json` to add hooks. Example — typecheck after every file edit:

```json
{
  "hooks": {
    "SessionStart": [ ... ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx tsc --noEmit 2>&1 | head -20",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

Common hook events for quality gates:

| Event | Use case |
|---|---|
| `PostToolUse` (matcher: `Edit\|Write`) | Typecheck, lint after edits |
| `PreToolUse` (matcher: `Bash`) | Guard dangerous commands |
| `Stop` | Run tests before Claude says "done" |

### Using /revise-claude-md

Requires the `claude-md-management` plugin. Run at the end of a productive session:

```
/revise-claude-md
```

It reflects on the session, identifies patterns/gotchas/commands discovered, and proposes targeted one-line additions to your CLAUDE.md. You approve each change individually.

### Using /code-review

Requires the `code-review` plugin. Before merging a PR:

```
/code-review 123
```

Launches 8+ parallel review agents checking for bugs, CLAUDE.md compliance, git history context, past PR comments, and code comment compliance. Only high-confidence findings (80+ score) make the cut. Posts directly to the GitHub PR as a comment.

---

## Tips

1. **CLAUDE.md stays lean.** `/bootstrap` populates it initially. `/revise-claude-md` adds to it over time. But prune regularly — every token in CLAUDE.md is read every session.

2. **Rules over CLAUDE.md for conventions.** Commit format, testing rules, API conventions — these go in `.claude/rules/`, not CLAUDE.md. Rules are modular and can be path-scoped.

3. **Don't create custom agents unless you need context isolation.** Claude's built-in delegation (Task tool) handles generic roles. Custom agents are for domain-specific work with restricted tool access.

4. **Don't create skills unless there's reusable domain knowledge.** If it's a one-time task, just ask Claude directly.

5. **The behavioral system is layered intentionally.** The global hook handles 99% of drift. The hookify rule is a per-project backup. `/agent-behavior` is the emergency fallback. If you need `/agent-behavior` frequently, something is wrong with the hook setup.

6. **Session-start hook needs git.** If you're not in a git repo, it outputs "Not a git repository" — harmless but not useful. Run `git init` before starting Claude.

7. **`.local.md` files are gitignored.** Use them for personal preferences. Use non-local files for team-shared rules.
