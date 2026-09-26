# Agent skill

A drop-in skill that teaches an AI coding agent how to use `agentdraft` correctly: publish
a plan or report to a versioned review URL, upload a screenshot or log to a public URL,
revise without breaking the reviewer's link, and stay inside the HTML policy.

One skill covers both lanes (`agentdraft upload` and `agentdraft file`), because the
decision between them is the first thing an agent gets wrong.

```
skills/agentdraft/
├── SKILL.md                 what to do, when, and the pitfalls — loaded into context
└── references/
    ├── cli.md               every command and flag, verified against --help
    └── errors.md            every server error code and the fix
```

The `SKILL.md` format originated with [Claude Code](https://code.claude.com/docs/en/skills)
and is read by Codex, Kiro, Cursor, Hermes Agent, and most other agent runtimes. The
frontmatter here uses only the portable fields (`name`, `description`, `license`,
`metadata`), so the same directory works everywhere.

## Install

### With the `skills` CLI (any agent)

```bash
npx skills add Tapetide-hq/agentdraft -g            # pick agents interactively
npx skills add Tapetide-hq/agentdraft -g -a claude-code codex kiro-cli -y
```

Drop `-g` to install into the current project instead of your home directory.

### By hand

Copy (or symlink) the directory into wherever your agent looks for user-level skills:

| Agent | User-level directory | Project-level directory |
|---|---|---|
| Claude Code | `~/.claude/skills/agentdraft` | `.claude/skills/agentdraft` |
| Codex | `~/.agents/skills/agentdraft` | `.agents/skills/agentdraft` |
| Kiro | `~/.kiro/skills/agentdraft` | `.kiro/skills/agentdraft` |
| Cursor | `~/.cursor/skills/agentdraft` | `.cursor/skills/agentdraft` |
| Hermes Agent | `~/.hermes/skills/agentdraft` | — |

```bash
git clone --depth 1 https://github.com/Tapetide-hq/agentdraft.git /tmp/agentdraft
for d in ~/.claude/skills ~/.agents/skills ~/.kiro/skills; do
  mkdir -p "$d" && cp -R /tmp/agentdraft/skills/agentdraft "$d/"
done
```

Most runtimes index skills at session start, so open a new session before expecting the
agent to see it. The skill installs the CLI itself if `agentdraft` is missing, but it will
stop and ask for an API key rather than invent one.

## Why ship this

Left to guess, an agent will invent flags that don't exist, publish a revision as a second
draft and strand the reviewer on a dead link, reach for an external stylesheet that the
HTML policy rejects, force a document to download by using `file` instead of `upload`, or
hand back a `/tmp` path instead of a URL. The skill encodes the behaviour that actually
works, so nobody has to rediscover it.

Every command, flag, and error code in the skill is verified against the real CLI and the
worker source, not written from memory. **If you change CLI or API behaviour, update
`skills/agentdraft/` in the same PR.**
