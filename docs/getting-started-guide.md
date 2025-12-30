# Getting Started with Planning Agent Framework

## 📚 Quick Start Guide

### Prerequisites

```bash
# Required dependencies
npm install ai @ai-sdk/anthropic zod
# or
pnpm add ai @ai-sdk/anthropic zod
```

### Environment Setup

```bash
# .env
ANTHROPIC_API_KEY=your_api_key_here
# or OpenAI
OPENAI_API_KEY=your_api_key_here
```

## 🚀 Basic Usage

### 1. Simple Task (No Planning)

```typescript
import { MainAgent } from './planning-agent-framework'
import { anthropic } from '@ai-sdk/anthropic'

const agent = new MainAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  tools: {
    webSearch: tool({
      description: 'Search the web',
      parameters: z.object({
        query: z.string()
      }),
      execute: async ({ query }) => {
        // Your search implementation
        return { results: [...] }
      }
    })
  }
})

// Direct execution for simple queries
const result = await agent.execute("What's the weather today?")
console.log(result.response)
```

### 2. Complex Task (With Planning)

```typescript
const result = await agent.execute(
  "Research the top 3 AI frameworks, " +
  "compare their features, and create a markdown table"
)

console.log('Plan:', result.plan)
// Plan will have steps like:
// 1. Research framework 1 (sub-agent)
// 2. Research framework 2 (sub-agent)
// 3. Research framework 3 (sub-agent)
// 4. Compare features
// 5. Create markdown table

console.log('Response:', result.response)
```

## 📖 Core Concepts

### Planning System

The framework automatically decides when to create a plan:

```typescript
// These trigger planning:
"Research X and create Y"        // Multiple steps
"Compare A, B, and C"            // Research required
"First do X, then do Y"          // Sequential dependencies
"Analyze data and generate report" // Complex workflow

// These don't:
"What's 2+2?"                    // Simple calculation
"Translate this text"            // Single operation
"Search for X"                   // Single tool call
```

### Plan Structure

```typescript
interface Plan {
  id: string
  objective: string
  steps: [
    {
      id: "step-1",
      description: "Research framework 1",
      status: "completed",
      dependencies: [],
      toolsNeeded: ["webSearch"],
      result: { ... }
    },
    {
      id: "step-2",
      description: "Compare features",
      status: "pending",
      dependencies: ["step-1"], // Depends on step-1
      toolsNeeded: ["readFile"],
      result: null
    }
  ]
  metadata: {
    complexity: "medium",
    estimatedTime: 30,
    requiresSubAgent: true
  }
}
```

### Sub-Agents

Sub-agents are spawned for research-heavy tasks:

```typescript
// This will spawn a sub-agent:
const result = await agent.execute(
  "Research current trends in AI safety"
)

// Sub-agent:
// - Has limited tools (read-only)
// - Cannot spawn more sub-agents
// - Returns results to main agent
// - Isolated context
```

## 🛠️ Custom Tools

### Creating Tools

```typescript
import { tool } from 'ai'
import { z } from 'zod'

const myTool = tool({
  description: 'Clear description of what this tool does',
  parameters: z.object({
    param1: z.string().describe('Description of param1'),
    param2: z.number().optional()
  }),
  execute: async ({ param1, param2 }) => {
    // Your implementation
    return { result: 'data' }
  }
})
```

### Tool with Approval

```typescript
const dangerousTool = tool({
  description: 'Delete a file',
  parameters: z.object({
    path: z.string()
  }),
  needsApproval: true, // Requires human approval
  execute: async ({ path }) => {
    // This will pause and wait for approval
    fs.unlinkSync(path)
    return { deleted: true }
  }
})
```

### Tool Categories

```typescript
const tools = {
  // Read-only (safe for sub-agents)
  webSearch: tool({ ... }),
  readFile: tool({ ... }),
  getWeather: tool({ ... }),
  
  // Write operations (main agent only, needs approval)
  writeFile: tool({ needsApproval: true, ... }),
  deleteFile: tool({ needsApproval: true, ... }),
  sendEmail: tool({ needsApproval: true, ... }),
  
  // API calls
  apiGet: tool({ ... }),
  apiPost: tool({ needsApproval: true, ... })
}
```

## 🔄 Workflow Examples

### Example 1: Research & Compare

```typescript
const result = await agent.execute(`
  Research these 3 companies:
  1. OpenAI
  2. Anthropic
  3. Google DeepMind
  
  Compare their:
  - Founding year
  - Key products
  - Research focus
  
  Create a comparison table.
`)

// Execution plan:
// Step 1: Research OpenAI (sub-agent)
// Step 2: Research Anthropic (sub-agent)  
// Step 3: Research Google DeepMind (sub-agent)
// Step 4: Compare data (main agent)
// Step 5: Create markdown table (main agent)
```

### Example 2: Data Pipeline

```typescript
const result = await agent.execute(`
  1. Fetch data from API endpoint https://api.example.com/data
  2. Parse the JSON response
  3. Filter for items with status='active'
  4. Sort by date
  5. Save to output.json
`)

// Execution plan with dependencies:
// Step 1: API call → result: raw data
// Step 2: Parse (depends on 1) → result: parsed data
// Step 3: Filter (depends on 2) → result: filtered data
// Step 4: Sort (depends on 3) → result: sorted data
// Step 5: Save (depends on 4) → result: file saved
```

### Example 3: Content Creation

```typescript
const result = await agent.execute(`
  Write a blog post about TypeScript best practices.
  
  Requirements:
  - Research current trends
  - Include code examples
  - Add a comparison table
  - 1000-1500 words
`)

// Execution plan:
// Step 1: Research TypeScript trends (sub-agent)
// Step 2: Outline blog post structure
// Step 3: Write introduction
// Step 4: Write main sections with code examples
// Step 5: Create comparison table
// Step 6: Write conclusion
// Step 7: Review and polish
```

## 🎛️ Configuration

### Agent Configuration

```typescript
const agent = new MainAgent({
  model: anthropic('claude-sonnet-4-20250514'),
  tools: yourTools,
  
  // Optional config (coming soon)
  config: {
    maxPlanSteps: 20,        // Max steps in a plan
    maxSubAgentSpawns: 3,    // Max concurrent sub-agents
    maxRetries: 3,           // Retry failed steps
    contextMaxTokens: 100000 // Context limit
  }
})
```

### Model Selection

```typescript
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'

// Use Claude for complex reasoning
const agent1 = new MainAgent({
  model: anthropic('claude-sonnet-4-20250514')
})

// Use GPT-4 for faster responses
const agent2 = new MainAgent({
  model: openai('gpt-4-turbo')
})

// Use different models for different components
const agent3 = new MainAgent({
  model: anthropic('claude-sonnet-4-20250514'), // Main reasoning
  planningModel: openai('gpt-4-turbo'),         // Fast planning
  subAgentModel: anthropic('claude-haiku-4-5')  // Cheap sub-agents
})
```

## 📊 Monitoring & Debugging

### Execution History

```typescript
const result = await agent.execute(task)

// Access execution details
console.log('Plan:', result.plan)
console.log('Steps executed:', result.plan.steps)
console.log('History:', result.executionHistory)

// Check individual steps
result.plan.steps.forEach(step => {
  console.log(`${step.id}: ${step.status}`)
  if (step.error) {
    console.error(`Error: ${step.error}`)
  }
})
```

### Logging

```typescript
// Built-in logging (to console)
[MainAgent] Processing: "Research AI frameworks"
[MainAgent] Complex task - creating plan
[MainAgent] Plan created with 5 steps
  1. Research framework 1
  2. Research framework 2
  3. Research framework 3
  4. Compare features
  5. Create table
[MainAgent] Starting execution phase...
[MainAgent] Spawning sub-agent for: Research framework 1
[SubAgent] Executing: Research framework 1
[Tool:webSearch] Query: framework 1 features
...
```

## 🚧 Error Handling

### Retry Logic

```typescript
// Automatic retry for failed steps
// Max 3 attempts with exponential backoff

result.plan.steps.forEach(step => {
  if (step.status === 'failed') {
    console.log(`Step ${step.id} failed: ${step.error}`)
    // Framework automatically retries up to 3 times
  }
})
```

### Custom Error Handling

```typescript
try {
  const result = await agent.execute(task)
  
  if (!result.success) {
    // Handle partial completion
    console.log('Completed steps:', 
      result.plan.steps.filter(s => s.status === 'completed')
    )
  }
} catch (error) {
  console.error('Agent execution failed:', error)
}
```

## 🎯 Best Practices

### 1. Clear Task Descriptions

```typescript
// ❌ Bad - Vague
"Do something with the data"

// ✅ Good - Specific
"Fetch user data from API, filter active users, sort by join date, export to CSV"
```

### 2. Tool Descriptions

```typescript
// ❌ Bad
description: 'Search tool'

// ✅ Good
description: 'Search the web for current information. Use this when you need up-to-date facts, news, or research data. Returns top 5 results with title, URL, and snippet.'
```

### 3. Manage Complexity

```typescript
// Break down very complex tasks
// ❌ Too complex for one call
"Build a complete e-commerce website"

// ✅ Break into phases
Phase 1: "Design database schema for products, users, orders"
Phase 2: "Create API endpoints for CRUD operations"
Phase 3: "Build frontend components"
```

### 4. Use Sub-agents Wisely

```typescript
// Sub-agents are great for:
- Research tasks
- Independent data gathering
- Parallel processing

// Don't use sub-agents for:
- Simple operations
- Tasks needing main context
- Sequential dependent steps
```

## 📈 Performance Tips

### 1. Context Management

```typescript
// Context auto-compacts at 80k tokens
// Keep important info at the start

agent.execute(`
  [Important context first]
  User preferences: {...}
  Project requirements: {...}
  
  [Task]
  Do the thing...
`)
```

### 2. Parallel Execution

```typescript
// Independent steps run in parallel automatically
"Research A, B, and C"
// → 3 sub-agents run concurrently

// Sequential tasks run in order
"Research A, then use that to analyze B"
// → Step 2 waits for Step 1
```

### 3. Model Selection

```typescript
// Use fast models for simple steps
// Use powerful models for complex reasoning

// Coming soon:
agent.execute(task, {
  useHaikuForSubAgents: true,  // Cheaper
  useSonnetForPlanning: true,  // Better quality
  useOpusForSynthesis: true    // Best reasoning
})
```

## 🔗 Integration Examples

### Next.js API Route

```typescript
// app/api/agent/route.ts
import { MainAgent } from '@/lib/planning-agent'
import { anthropic } from '@ai-sdk/anthropic'

export async function POST(req: Request) {
  const { task } = await req.json()
  
  const agent = new MainAgent({
    model: anthropic('claude-sonnet-4-20250514'),
    tools: myTools
  })
  
  const result = await agent.execute(task)
  
  return Response.json(result)
}
```

### Streaming Response (Coming Soon)

```typescript
const stream = await agent.executeStream(task)

for await (const chunk of stream) {
  if (chunk.type === 'plan') {
    console.log('Plan created:', chunk.plan)
  } else if (chunk.type === 'step_complete') {
    console.log('Step done:', chunk.step)
  } else if (chunk.type === 'final') {
    console.log('Complete:', chunk.response)
  }
}
```

## 📚 Additional Resources

- [Architecture Documentation](./planning-agent-framework-architecture.md)
- [API Reference](./api-reference.md) (coming soon)
- [Examples](./examples/) (coming soon)
- [Troubleshooting](./troubleshooting.md) (coming soon)

## 🤝 Contributing

This is a concept framework. Feedback and ideas welcome!

Key areas for improvement:
- [ ] Streaming support
- [ ] Better error recovery
- [ ] Metrics & analytics
- [ ] Persistent memory
- [ ] Custom verification strategies
- [ ] Dynamic model selection
- [ ] Cost optimization

## 📝 License

MIT (or your choice)
