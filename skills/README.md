# Agent Skills

Drop-in instructions that teach an AI coding agent how to use `agentdraft` correctly.

A skill is a single `SKILL.md`: YAML frontmatter (name, description, trigger) plus a
markdown body with commands, constraints, and pitfalls. The format originated with
[Claude Code](https://code.claude.com/docs/en/skills) and is read by several agent
runtimes, including Hermes Agent and Cursor.

## Available skills

| Skill | Use when |
|---|---|
| [`agentdraft-publish-draft`](./agentdraft-publish-draft/SKILL.md) | A human needs to read agent output in a browser — plans, proposals, reports, audits |

## Install

Copy the skill directory into wherever your agent looks for skills:

```bash
# Claude Code (project-scoped)
mkdir -p .claude/skills && cp -r skills/agentdraft-publish-draft .claude/skills/

# Hermes Agent (user-scoped)
cp -r skills/agentdraft-publish-draft ~/.hermes/skills/
```

Most runtimes cache the skill index at session start, so start a new session before
expecting the agent to see a newly copied skill.

## Why ship these

Left to guess, an agent will invent flags that don't exist, publish a revision as a second
draft and strand the reviewer on a dead link, reach for an external stylesheet that the
HTML policy rejects, or hand back a `/tmp` path instead of a URL. The skill encodes the
behaviour that actually works, so nobody has to rediscover it.

Every command, flag, error code, and exit code in these skills is verified against the
real CLI and live API — not written from the docs. If you change CLI behaviour, update the
matching skill in the same PR.
