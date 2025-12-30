# Planning Agent Framework - Architecture Design
## Inspired by Claude Code, Built with AI SDK

## 🎯 Design Goals

1. **Planning-first approach** - Generate TODO plan before execution
2. **Single-thread architecture** - Simple, debuggable (like Claude Code)
3. **Sub-agent support** - Max 1 level for complex tasks
4. **Context management** - Smart memory & conversation handling
5. **Built with AI SDK** - Leverage Vercel's ecosystem
6. **No commands/MCP** - Focus on core planning capabilities

## 🏗️ Architecture Overview

```
User Input
    ↓
Main Agent
    ├─→ Planning Phase (generate TODO)
    ├─→ Execution Phase (execute tasks)
    ├─→ Verification Phase (verify results)
    └─→ Response
```

## 📐 Core Components

### 1. **MainAgent** (Single Thread)
```typescript
class MainAgent {
  // Core properties
  model: LanguageModel
  tools: Record<string, Tool>
  conversationHistory: Message[]
  contextManager: ContextManager
  
  // Main workflow
  async execute(input: string): Promise<AgentResponse>
}
```

**Responsibilities**:
- Receive user input
- Decide: Direct response vs Planning needed
- Manage conversation context
- Coordinate sub-agents if needed

### 2. **PlanningSystem**
```typescript
class PlanningSystem {
  async createPlan(task: string, context: Context): Promise<Plan>
  async refinePlan(plan: Plan, feedback: string): Promise<Plan>
  async trackProgress(plan: Plan): Promise<PlanStatus>
}

interface Plan {
  id: string
  objective: string
  steps: PlanStep[]
  metadata: {
    complexity: 'simple' | 'medium' | 'complex'
    estimatedTime: number
    requiresSubAgent: boolean
  }
}

interface PlanStep {
  id: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  dependencies: string[] // IDs of steps that must complete first
  toolsNeeded: string[]
  result?: any
  error?: string
}
```

**Workflow**:
```
User Task → Analyze Complexity
    ↓
  Simple? → Direct execution (no plan)
    ↓
  Complex? → Generate Plan
    ↓
├─→ Research Phase (gather info)
├─→ Create TODO steps
├─→ Identify dependencies
└─→ Estimate complexity
```

### 3. **ExecutionEngine**
```typescript
class ExecutionEngine {
  async executeStep(
    step: PlanStep, 
    tools: Record<string, Tool>,
    context: Context
  ): Promise<StepResult>
  
  async executeParallel(
    steps: PlanStep[]
  ): Promise<StepResult[]>
  
  async handleStepFailure(
    step: PlanStep,
    error: Error
  ): Promise<RetryStrategy>
}
```

**Features**:
- Sequential execution with dependencies
- Parallel execution for independent steps
- Retry logic với exponential backoff
- Tool invocation management

### 4. **SubAgent** (Max 1 Level)
```typescript
class SubAgent {
  parentContext: Context
  limitedTools: Record<string, Tool> // Subset of tools
  cannotSpawnSubAgents: true // Hard constraint
  
  async executeTask(task: string): Promise<SubAgentResult>
}
```

**Key Constraints**:
- ✅ Isolated context (doesn't pollute main thread)
- ✅ Limited tool access (security)
- ❌ Cannot spawn nested sub-agents
- ✅ Result returned to main agent as tool response

**When to spawn**:
```typescript
shouldSpawnSubAgent(step: PlanStep): boolean {
  return (
    step.complexity === 'high' &&
    step.requiresResearch &&
    !step.requiresMainContext // Doesn't need full history
  )
}
```

### 5. **ContextManager**
```typescript
class ContextManager {
  private history: Message[]
  private maxTokens: number
  private currentPlan?: Plan
  
  // Compact when approaching limit
  async compact(): Promise<void> {
    // Summarize old messages
    // Keep recent context
    // Preserve current plan
  }
  
  // Get relevant context for next step
  getRelevantContext(step: PlanStep): Context {
    return {
      recentMessages: this.getRecentN(10),
      planContext: this.currentPlan,
      stepHistory: this.getStepResults(step.dependencies)
    }
  }
}
```

**Features**:
- Automatic compaction (like Claude Code)
- Context-aware retrieval
- Plan persistence in context

### 6. **VerificationSystem**
```typescript
class VerificationSystem {
  async verifyStepResult(
    step: PlanStep,
    result: any
  ): Promise<VerificationResult>
  
  async verifyPlanCompletion(
    plan: Plan
  ): Promise<boolean>
}

interface VerificationResult {
  isValid: boolean
  confidence: number
  issues?: string[]
  suggestedFix?: string
}
```

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────┐
│          USER INPUT                             │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│     MAIN AGENT - Analyze Input                  │
│  - Parse intent                                 │
│  - Assess complexity                            │
│  - Check context                                │
└────────────────┬────────────────────────────────┘
                 ↓
          ┌──────┴──────┐
          │             │
      SIMPLE        COMPLEX
       TASK          TASK
          │             │
          ↓             ↓
    ┌─────────┐   ┌──────────────────────────┐
    │ Direct  │   │  PLANNING PHASE           │
    │ Execute │   │  ┌────────────────────┐   │
    └────┬────┘   │  │ 1. Research        │   │
         │        │  │    - Gather info   │   │
         │        │  │    - Use sub-agent?│   │
         │        │  └────────┬───────────┘   │
         │        │           ↓               │
         │        │  ┌────────────────────┐   │
         │        │  │ 2. Create Plan     │   │
         │        │  │    - Generate TODOs│   │
         │        │  │    - Dependencies  │   │
         │        │  │    - Tool mapping  │   │
         │        │  └────────┬───────────┘   │
         │        └───────────┼───────────────┘
         │                    ↓
         │        ┌──────────────────────────┐
         │        │  EXECUTION PHASE          │
         │        │  ┌────────────────────┐   │
         │        │  │ For each step:     │   │
         │        │  │                    │   │
         │        │  │ - Check deps       │   │
         │        │  │ - Execute tools    │   │
         │        │  │ - Spawn sub-agent? │   │
         │        │  │ - Store result     │   │
         │        │  └────────┬───────────┘   │
         │        └───────────┼───────────────┘
         │                    ↓
         │        ┌──────────────────────────┐
         │        │  VERIFICATION PHASE       │
         │        │  ┌────────────────────┐   │
         │        │  │ Verify each result │   │
         │        │  └────────┬───────────┘   │
         │        │           ↓               │
         │        │  ┌────────────────────┐   │
         │        │  │ All complete?      │   │
         │        │  └────────┬───────────┘   │
         │        │           │               │
         │        │     ┌─────┴─────┐         │
         │        │     │           │         │
         │        │    YES         NO          │
         │        │     │           │         │
         │        │     │      ┌────┴─────┐   │
         │        │     │      │ Replan/  │   │
         │        │     │      │ Retry    │   │
         │        │     │      └────┬─────┘   │
         │        │     │           │         │
         │        │     └───────┬───┘         │
         │        └─────────────┼─────────────┘
         │                      ↓
         └──────────────┬───────┘
                        ↓
                ┌───────────────┐
                │   RESPONSE    │
                └───────────────┘
```

## 🛠️ Tool System

```typescript
interface Tool {
  name: string
  description: string
  schema: z.ZodSchema
  execute: (params: any, context: Context) => Promise<any>
  needsApproval?: boolean // Human-in-the-loop
}

// Example tools
const tools = {
  webSearch: tool({
    description: 'Search the web for current information',
    schema: z.object({
      query: z.string(),
      maxResults: z.number().optional()
    }),
    execute: async ({ query, maxResults = 5 }) => {
      // Implementation
    }
  }),
  
  fileOperation: tool({
    description: 'Read or write files',
    schema: z.object({
      action: z.enum(['read', 'write', 'delete']),
      path: z.string(),
      content: z.string().optional()
    }),
    needsApproval: true, // Requires human approval
    execute: async ({ action, path, content }) => {
      // Implementation
    }
  }),
  
  apiCall: tool({
    description: 'Make HTTP API calls',
    schema: z.object({
      url: z.string(),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
      body: z.any().optional()
    }),
    execute: async ({ url, method, body }) => {
      // Implementation
    }
  })
}
```

## 📊 State Management

```typescript
interface AgentState {
  conversationId: string
  currentPlan?: Plan
  executionHistory: ExecutionRecord[]
  context: {
    messages: Message[]
    totalTokens: number
    lastCompactAt?: Date
  }
  metadata: {
    startTime: Date
    totalSteps: number
    completedSteps: number
  }
}

interface ExecutionRecord {
  stepId: string
  startTime: Date
  endTime: Date
  result: any
  tokensUsed: number
  toolsCalled: string[]
}
```

## 🔁 Feedback Loop (Claude Code style)

```typescript
class FeedbackLoop {
  async run(task: string): Promise<Result> {
    let context = await this.gatherContext()
    let attempts = 0
    const maxAttempts = 3
    
    while (attempts < maxAttempts) {
      // 1. GATHER CONTEXT
      const relevantInfo = await this.gather(context)
      
      // 2. TAKE ACTION
      const result = await this.act(relevantInfo)
      
      // 3. VERIFY
      const verification = await this.verify(result)
      
      if (verification.isValid) {
        return result // Success!
      }
      
      // 4. REFINE (if not valid)
      context = await this.refine(context, verification)
      attempts++
    }
    
    throw new Error('Max attempts reached')
  }
}
```

## 💾 Memory & Persistence

```typescript
interface MemoryManager {
  // Short-term (in conversation)
  conversationMemory: Message[]
  
  // Long-term (optional - outside scope initially)
  // persistentMemory?: VectorStore
  
  // Plan memory
  activePlans: Map<string, Plan>
  completedPlans: Plan[]
  
  // Methods
  remember(key: string, value: any): void
  recall(key: string): any | undefined
  forget(key: string): void
}
```

## 📈 Monitoring & Observability

```typescript
interface AgentMetrics {
  totalRequests: number
  averageResponseTime: number
  successRate: number
  toolUsageStats: Record<string, number>
  planComplexityDistribution: {
    simple: number
    medium: number
    complex: number
  }
  subAgentSpawnRate: number
}

class MetricsCollector {
  track(event: AgentEvent): void
  getMetrics(): AgentMetrics
  export(): Promise<void>
}
```

## 🎨 Usage Examples

### Example 1: Simple Task (No Planning)
```typescript
const agent = new MainAgent({ model, tools })

const result = await agent.execute(
  "What's the weather in Ho Chi Minh City?"
)
// Direct response, no plan needed
```

### Example 2: Complex Task (With Planning)
```typescript
const result = await agent.execute(
  "Research the top 3 AI frameworks, compare their features, " +
  "and create a markdown comparison table"
)

// Behind the scenes:
// 1. Planning Phase
//    ├─ Step 1: Research framework 1 (sub-agent)
//    ├─ Step 2: Research framework 2 (sub-agent)
//    ├─ Step 3: Research framework 3 (sub-agent)
//    ├─ Step 4: Compare features (main agent)
//    └─ Step 5: Create markdown table (main agent)
//
// 2. Execution Phase (parallel research)
// 3. Verification Phase
// 4. Response with markdown table
```

### Example 3: Multi-step with Dependencies
```typescript
const result = await agent.execute(
  "1. Search for React best practices 2024, " +
  "2. Based on that, create a sample component, " +
  "3. Then write tests for it"
)

// Plan with dependencies:
// Step 1: web search (no deps)
//   ↓
// Step 2: create component (depends on Step 1)
//   ↓  
// Step 3: write tests (depends on Step 2)
```

## 🚀 Implementation Roadmap

### Phase 1: Core (MVP)
- [x] MainAgent with basic loop
- [x] PlanningSystem (TODO generation)
- [x] ExecutionEngine (sequential)
- [x] ContextManager (basic)
- [x] Tool system integration

### Phase 2: Advanced
- [ ] SubAgent system
- [ ] Parallel execution
- [ ] Verification system
- [ ] Smart context compaction
- [ ] Retry logic

### Phase 3: Production
- [ ] Metrics & monitoring
- [ ] Human-in-the-loop approval
- [ ] Error recovery
- [ ] Performance optimization
- [ ] Testing suite

## 🔒 Safety & Constraints

### Tool Execution
```typescript
// Automatic approval for read-only
const safeTools = ['webSearch', 'fileRead', 'apiGet']

// Require approval for write operations
const dangerousTools = ['fileWrite', 'fileDelete', 'apiPost']
```

### Rate Limiting
```typescript
interface RateLimits {
  maxStepsPerPlan: 20
  maxSubAgentSpawns: 3
  maxToolCallsPerStep: 5
  maxRetries: 3
}
```

### Context Limits
```typescript
const CONTEXT_LIMITS = {
  maxMessages: 50,
  maxTokens: 100_000,
  compactThreshold: 80_000, // 80% of max
  minContextAfterCompact: 20_000
}
```

## 🎯 Key Differences from Claude Code

| Feature | Claude Code | Our Framework |
|---------|-------------|---------------|
| **Domain** | Coding specific | General purpose |
| **Commands** | Yes (slash commands) | No |
| **MCP** | Full support | No (out of scope) |
| **Skills** | Prompt-based | Tool-based |
| **Planning** | Implicit | **Explicit TODO** |
| **Sub-agents** | 1 level max | 1 level max ✓ |
| **Architecture** | Single-thread | Single-thread ✓ |
| **UI** | Terminal (Ink/React) | API-based |

## 📦 Technology Stack

- **AI SDK**: Vercel AI SDK 6+ (ToolLoopAgent, tools)
- **Language**: TypeScript
- **Validation**: Zod schemas
- **State**: In-memory (can add persistence)
- **Models**: Any supported by AI SDK (OpenAI, Anthropic, etc.)

## 🎓 Best Practices

1. **Planning-first for complex tasks** - Don't jump to execution
2. **Clear tool descriptions** - Help LLM choose correctly
3. **Granular verification** - Verify each step, not just end result
4. **Smart context management** - Compact proactively
5. **Explicit error handling** - Always have retry logic
6. **Sub-agent sparingly** - Only when truly needed
7. **Track everything** - Metrics help improve system

## 🔄 Next Steps

1. Review this architecture
2. Get feedback on design decisions
3. Start Phase 1 implementation
4. Create example use cases
5. Build testing framework
6. Document API

---

**Philosophy**: "Simple things should be simple, complex things should be possible"

This framework provides structure for planning without being overly complex. It scales from simple Q&A to complex multi-step workflows, all while remaining debuggable and maintainable.
