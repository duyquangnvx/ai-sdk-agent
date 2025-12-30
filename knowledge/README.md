# Knowledge Base

This folder contains DSL documentation for the ScriptAgent.

## Files

| File | Purpose |
|------|---------|
| `dsl-syntax.md` | DSL syntax reference |
| `dsl-apis.md` | Available APIs and functions |
| `dsl-examples.md` | Code examples for common patterns |

## How to Use

1. Add your DSL documentation to the respective files
2. ScriptAgent will use this knowledge when writing scripts
3. Examples in `dsl-examples.md` help the agent learn patterns

## Loading

These files are loaded into ScriptAgent's instructions at startup.
See `src/ai/agents/script-agent.ts` for implementation.
