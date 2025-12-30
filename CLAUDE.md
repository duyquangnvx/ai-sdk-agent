# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Planning Agent Framework for building AI agents with autonomous task planning capabilities. Inspired by Claude Code's architecture, it provides a single-thread agent system with explicit TODO generation, sub-agent support, and comprehensive execution management using Vercel AI SDK.

**Key Architecture Principles**:
- Single-thread main agent (avoid multi-agent complexity)
- Max 1-level sub-agents (no nested hierarchies)
- Explicit plan generation before execution
- Feedback loop: Gather → Act → Verify → Repeat

## Project Structure

```
.claude/commands/        # SpecKit workflow commands (specify, plan, tasks, implement, etc.)
.specify/
  ├── memory/           # Project constitution and governance
  └── templates/        # Templates for specs, plans, tasks, checklists
docs/
  ├── planning-agent-framework-implementation.ts  # Reference implementation
  ├── planning-agent-framework-architecture.md    # Architecture design doc
  ├── getting-started-guide.md                    # User guide
  └── claude-code-architecture-explained.md       # Inspiration source
```

## Development Workflow (SpecKit Commands)

This project uses a structured development workflow via slash commands in `.claude/commands/`:

### 1. Feature Specification
```bash
/speckit.specify "feature description"
```
Creates user stories, requirements, and success criteria in `specs/[###-feature]/spec.md`

### 2. Implementation Planning
```bash
/speckit.plan
```
Researches codebase, designs architecture, creates `specs/[###-feature]/plan.md` with:
- Technical context and stack decisions
- Constitution compliance checks
- Data models, contracts, quickstart guides

### 3. Task Generation
```bash
/speckit.tasks
```
Converts design artifacts into dependency-ordered `specs/[###-feature]/tasks.md`
- Tasks grouped by user story (enables independent implementation)
- Parallel execution markers `[P]` for concurrent work
- Clear checkpoints for MVP delivery

### 4. Implementation
```bash
/speckit.implement
```
Executes all tasks from `tasks.md` in dependency order

### 5. Quality Assurance
```bash
/speckit.analyze     # Cross-artifact consistency analysis
/speckit.checklist   # Generate custom quality checklist
```

## Constitution & Quality Standards

**Location**: `.specify/memory/constitution.md` (v1.0.0)

All code changes MUST comply with four core principles:

### I. Code Quality
- TypeScript strict mode required; no `any` types
- Descriptive naming (no abbreviations except API/HTTP/URL)
- Single responsibility per module/class/function
- Files >300 lines require decomposition review
- Explicit error handling for all async operations
- JSDoc for public APIs

### II. Testing Standards
- Test-first development (tests written before implementation)
- 80%+ unit test coverage; 100% for critical paths
- Three test categories: Unit, Integration, Contract
- Tests must be deterministic (<10s execution)
- All tests pass before merge

### III. User Experience Consistency
- Consistent response formatting (JSON for structured data)
- Error messages explain what/why/how to fix
- Progress feedback for operations >2s
- CLI output parseable by standard tools (grep, jq)
- Breaking changes require migration guides

### IV. Performance Requirements
- Simple queries: <500ms p95 latency
- Complex planning: <5s p95 latency
- Stable memory (no leaks)
- Structured logs with correlation IDs
- Token usage tracking

**Quality Gates** (must pass before merge):
1. Zero ESLint/TypeScript errors
2. All tests pass + coverage thresholds
3. Production build without warnings
4. No >10% performance regression
5. No high/critical security vulnerabilities

## Architecture Concepts

### Planning System
Agents automatically decide when to create execution plans:
- **Triggers planning**: "Research X and create Y", "Compare A, B, C", "First X then Y"
- **Direct execution**: Simple queries, single operations, calculations

### Plan Structure
```typescript
Plan {
  objective: string
  steps: [{
    id: string
    description: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    dependencies: string[]  // Must complete before this step
    toolsNeeded: string[]
    result?: any
  }]
  metadata: {
    complexity: 'simple' | 'medium' | 'complex'
    requiresSubAgent: boolean
  }
}
```

### Sub-Agent System
- Spawned for research-heavy, independent tasks
- Max 1 level deep (cannot spawn nested sub-agents)
- Limited, read-only tools
- Results returned to main agent as tool response

### Tool System
Tools defined with Zod schemas:
```typescript
tool({
  description: 'Clear description for LLM to understand',
  parameters: z.object({ /* Zod schema */ }),
  needsApproval: boolean,  // For destructive operations
  execute: async (params) => { /* implementation */ }
})
```

## Key Implementation Files

**Reference Implementation**: `docs/planning-agent-framework-implementation.ts`

Core classes:
- `MainAgent`: Single-thread orchestrator
- `PlanningSystem`: TODO generation and complexity assessment
- `ExecutionEngine`: Step execution with dependency management
- `SubAgent`: Limited-scope research agent (max 1 level)
- `ContextManager`: Smart memory compaction
- `VerificationSystem`: Result validation

## Working with Templates

Templates in `.specify/templates/` use placeholder tokens:
- `[ALL_CAPS_IDENTIFIER]` format
- Constitution Check sections reference `.specify/memory/constitution.md`
- User story priorities (P1, P2, P3) enable incremental delivery
- Tasks marked `[P]` can execute in parallel (different files, no dependencies)

When modifying templates, update the constitution's Sync Impact Report if governance changes.

## Important Constraints

1. **No package.json yet**: This is a design/documentation project. When implementing, dependencies are:
   - `ai` (Vercel AI SDK)
   - `@ai-sdk/anthropic` or `@ai-sdk/openai`
   - `zod`

2. **TypeScript**: All implementation code must use TypeScript with strict mode

3. **Single-thread design**: Avoid complex multi-agent architectures. Main agent + optional single-level sub-agents only.

4. **Test-first**: For non-trivial features, write failing tests before implementation (Constitution Principle II)

5. **Plan-first**: Complex tasks require explicit planning phase before execution

## Model Selection Strategy

Inspired by Claude Code:
- **Haiku**: Fast, cheap tasks (formatting, parsing, summarization)
- **Sonnet**: Default workhorse (standard implementation)
- **Opus**: Complex reasoning (architecture decisions, refactoring)

## Governance Notes

- Constitution version: 1.0.0 (ratified 2025-12-30)
- All PRs must cite constitution principles when requesting changes
- Breaking changes require migration plans
- Version bumps: MAJOR (principle changes), MINOR (new sections), PATCH (clarifications)

## Development Philosophy

**"Simple things should be simple, complex things should be possible"**

This framework scales from simple Q&A to complex multi-step workflows while remaining debuggable and maintainable. Prefer simplicity over premature abstraction.
