// planning-agent-framework-implementation.ts
// Implementation example using Vercel AI SDK

import { ToolLoopAgent, tool } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface PlanStep {
  id: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  dependencies: string[]
  toolsNeeded: string[]
  result?: any
  error?: string
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

interface AgentContext {
  messages: any[]
  currentPlan?: Plan
  executionHistory: ExecutionRecord[]
}

interface ExecutionRecord {
  stepId: string
  startTime: Date
  endTime: Date
  result: any
  tokensUsed: number
}

// ============================================================================
// PLANNING SYSTEM
// ============================================================================

class PlanningSystem {
  private model: any

  constructor(model: any) {
    this.model = model
  }

  async createPlan(task: string, context: AgentContext): Promise<Plan> {
    const { object } = await this.model.generateObject({
      model: this.model,
      schema: z.object({
        objective: z.string().describe('The main objective'),
        complexity: z.enum(['simple', 'medium', 'complex']),
        estimatedTime: z.number().describe('Estimated time in seconds'),
        requiresSubAgent: z.boolean(),
        steps: z.array(
          z.object({
            id: z.string(),
            description: z.string(),
            dependencies: z.array(z.string()),
            toolsNeeded: z.array(z.string()),
          })
        ),
      }),
      prompt: `
Analyze this task and create a detailed execution plan:

Task: "${task}"

Context:
${JSON.stringify(context.executionHistory.slice(-3), null, 2)}

Create a plan with:
1. Clear, actionable steps
2. Dependencies between steps
3. Tools needed for each step
4. Complexity assessment

Guidelines:
- Simple: 1-2 steps, no research needed
- Medium: 3-5 steps, may need web search
- Complex: 6+ steps, requires research and sub-agents

Be specific and thorough.
      `,
    })

    return {
      id: `plan-${Date.now()}`,
      objective: object.objective,
      steps: object.steps.map((step) => ({
        ...step,
        status: 'pending' as const,
        dependencies: step.dependencies || [],
        toolsNeeded: step.toolsNeeded || [],
      })),
      metadata: {
        complexity: object.complexity,
        estimatedTime: object.estimatedTime,
        requiresSubAgent: object.requiresSubAgent,
      },
    }
  }

  async shouldPlan(task: string): Promise<boolean> {
    // Simple heuristic: plan if task is complex
    const complexityIndicators = [
      'research',
      'compare',
      'analyze',
      'create and',
      'multiple',
      'then',
      'after',
      'first.*then',
    ]

    const hasMultipleSteps = complexityIndicators.some((indicator) =>
      task.toLowerCase().includes(indicator)
    )

    const isLongTask = task.split(' ').length > 15

    return hasMultipleSteps || isLongTask
  }
}

// ============================================================================
// EXECUTION ENGINE
// ============================================================================

class ExecutionEngine {
  private tools: Record<string, any>

  constructor(tools: Record<string, any>) {
    this.tools = tools
  }

  async executeStep(
    step: PlanStep,
    context: AgentContext
  ): Promise<StepResult> {
    console.log(`Executing step: ${step.id} - ${step.description}`)

    const startTime = new Date()

    try {
      // Check dependencies
      const depsCompleted = step.dependencies.every((depId) => {
        const depStep = context.currentPlan?.steps.find((s) => s.id === depId)
        return depStep?.status === 'completed'
      })

      if (!depsCompleted) {
        throw new Error(`Dependencies not completed for step ${step.id}`)
      }

      // Execute using AI SDK
      const agent = new ToolLoopAgent({
        model: anthropic('claude-sonnet-4-20250514'),
        system: `
You are executing a specific step in a larger plan.

Current Step: ${step.description}
Tools Available: ${step.toolsNeeded.join(', ')}

Previous Results:
${this.getPreviousResults(step, context)}

Execute this step precisely. Return structured output.
        `,
        tools: this.getToolsForStep(step),
        maxSteps: 5, // Limit steps per sub-task
      })

      const result = await agent.execute(step.description)

      const endTime = new Date()

      return {
        success: true,
        data: result,
        duration: endTime.getTime() - startTime.getTime(),
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: new Date().getTime() - startTime.getTime(),
      }
    }
  }

  async executeParallel(
    steps: PlanStep[],
    context: AgentContext
  ): Promise<StepResult[]> {
    // Execute independent steps in parallel
    const independentSteps = steps.filter(
      (step) => step.dependencies.length === 0
    )

    console.log(`Executing ${independentSteps.length} steps in parallel`)

    return await Promise.all(
      independentSteps.map((step) => this.executeStep(step, context))
    )
  }

  private getPreviousResults(
    step: PlanStep,
    context: AgentContext
  ): string {
    return step.dependencies
      .map((depId) => {
        const dep = context.currentPlan?.steps.find((s) => s.id === depId)
        return dep
          ? `${dep.description}: ${JSON.stringify(dep.result)}`
          : ''
      })
      .join('\n')
  }

  private getToolsForStep(step: PlanStep): Record<string, any> {
    const toolSubset = {}
    step.toolsNeeded.forEach((toolName) => {
      if (this.tools[toolName]) {
        toolSubset[toolName] = this.tools[toolName]
      }
    })
    return toolSubset
  }
}

// ============================================================================
// SUB-AGENT SYSTEM
// ============================================================================

class SubAgent {
  private model: any
  private tools: Record<string, any>
  private parentContext: AgentContext

  constructor(
    model: any,
    tools: Record<string, any>,
    parentContext: AgentContext
  ) {
    this.model = model
    this.tools = tools // Limited tools
    this.parentContext = parentContext
  }

  async executeTask(task: string): Promise<any> {
    console.log(`[SubAgent] Executing: ${task}`)

    const agent = new ToolLoopAgent({
      model: this.model,
      system: `
You are a specialized sub-agent focused on a specific research task.

Task: ${task}

You have limited tools and cannot spawn additional agents.
Complete this task thoroughly and return structured results.
      `,
      tools: this.tools,
      maxSteps: 10, // Sub-agents get more steps for research
    })

    const result = await agent.execute(task)

    return {
      task,
      result,
      completedAt: new Date(),
    }
  }
}

// ============================================================================
// CONTEXT MANAGER
// ============================================================================

class ContextManager {
  private maxMessages = 50
  private maxTokens = 100000
  private compactThreshold = 80000

  async compact(context: AgentContext): Promise<AgentContext> {
    console.log('[ContextManager] Compacting context...')

    // Keep recent messages, summarize older ones
    const recentMessages = context.messages.slice(-20)

    // Summarize older messages
    const olderMessages = context.messages.slice(0, -20)
    const summary = await this.summarizeMessages(olderMessages)

    return {
      ...context,
      messages: [
        { role: 'system', content: `Previous conversation summary: ${summary}` },
        ...recentMessages,
      ],
    }
  }

  private async summarizeMessages(messages: any[]): Promise<string> {
    // In production, use LLM to summarize
    // For now, simple concatenation
    return messages
      .map((m) => `${m.role}: ${m.content}`)
      .join(' ')
      .slice(0, 500)
  }

  getRelevantContext(step: PlanStep, context: AgentContext): any {
    return {
      recentMessages: context.messages.slice(-10),
      planContext: context.currentPlan,
      stepHistory: context.executionHistory.filter((record) =>
        step.dependencies.includes(record.stepId)
      ),
    }
  }
}

// ============================================================================
// VERIFICATION SYSTEM
// ============================================================================

class VerificationSystem {
  private model: any

  constructor(model: any) {
    this.model = model
  }

  async verifyStepResult(
    step: PlanStep,
    result: any
  ): Promise<VerificationResult> {
    const { object } = await this.model.generateObject({
      model: this.model,
      schema: z.object({
        isValid: z.boolean(),
        confidence: z.number().min(0).max(1),
        issues: z.array(z.string()).optional(),
        suggestedFix: z.string().optional(),
      }),
      prompt: `
Verify if this step execution was successful:

Step: ${step.description}
Result: ${JSON.stringify(result, null, 2)}

Check if:
1. The step objective was achieved
2. The result is complete and correct
3. No errors or issues present

Provide verification with confidence score.
      `,
    })

    return object
  }

  async verifyPlanCompletion(plan: Plan): Promise<boolean> {
    return plan.steps.every((step) => step.status === 'completed')
  }
}

// ============================================================================
// MAIN AGENT
// ============================================================================

class MainAgent {
  private model: any
  private tools: Record<string, any>
  private planningSystem: PlanningSystem
  private executionEngine: ExecutionEngine
  private contextManager: ContextManager
  private verificationSystem: VerificationSystem
  private context: AgentContext

  constructor(config: {
    model: any
    tools: Record<string, any>
  }) {
    this.model = config.model
    this.tools = config.tools
    this.planningSystem = new PlanningSystem(this.model)
    this.executionEngine = new ExecutionEngine(this.tools)
    this.contextManager = new ContextManager()
    this.verificationSystem = new VerificationSystem(this.model)
    this.context = {
      messages: [],
      executionHistory: [],
    }
  }

  async execute(input: string): Promise<AgentResponse> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`[MainAgent] Processing: "${input}"`)
    console.log('='.repeat(60))

    // Add user message to context
    this.context.messages.push({ role: 'user', content: input })

    // Decide if planning is needed
    const needsPlanning = await this.planningSystem.shouldPlan(input)

    if (!needsPlanning) {
      console.log('[MainAgent] Simple task - direct execution')
      return await this.directExecution(input)
    }

    console.log('[MainAgent] Complex task - creating plan')

    // PHASE 1: PLANNING
    const plan = await this.planningSystem.createPlan(input, this.context)
    this.context.currentPlan = plan

    console.log(`[MainAgent] Plan created with ${plan.steps.length} steps`)
    plan.steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step.description}`)
    })

    // PHASE 2: EXECUTION
    console.log('\n[MainAgent] Starting execution phase...')

    for (const step of plan.steps) {
      // Check if should spawn sub-agent
      if (this.shouldSpawnSubAgent(step)) {
        console.log(`[MainAgent] Spawning sub-agent for: ${step.description}`)
        const subAgent = new SubAgent(
          this.model,
          this.getSubAgentTools(step),
          this.context
        )
        const result = await subAgent.executeTask(step.description)
        step.result = result
        step.status = 'completed'
      } else {
        // Execute in main agent
        step.status = 'in_progress'
        const result = await this.executionEngine.executeStep(
          step,
          this.context
        )

        if (result.success) {
          step.result = result.data
          step.status = 'completed'

          // PHASE 3: VERIFICATION
          const verification = await this.verificationSystem.verifyStepResult(
            step,
            result.data
          )

          if (!verification.isValid) {
            console.log(`[MainAgent] Verification failed for step ${step.id}`)
            step.status = 'failed'
            step.error = verification.issues?.join(', ')

            // Retry logic here...
          }
        } else {
          step.status = 'failed'
          step.error = result.error
        }
      }

      // Record execution
      this.context.executionHistory.push({
        stepId: step.id,
        startTime: new Date(),
        endTime: new Date(),
        result: step.result,
        tokensUsed: 0, // Track if needed
      })
    }

    // Check if plan completed
    const planCompleted = await this.verificationSystem.verifyPlanCompletion(
      plan
    )

    if (!planCompleted) {
      console.log('[MainAgent] Plan incomplete - some steps failed')
      // Handle failures...
    }

    // Generate final response
    const response = await this.generateResponse(plan)

    return {
      success: planCompleted,
      response,
      plan,
      executionHistory: this.context.executionHistory,
    }
  }

  private async directExecution(input: string): Promise<AgentResponse> {
    const agent = new ToolLoopAgent({
      model: this.model,
      system: 'You are a helpful assistant.',
      tools: this.tools,
      maxSteps: 3,
    })

    const result = await agent.execute(input)

    return {
      success: true,
      response: result.text,
      plan: null,
      executionHistory: [],
    }
  }

  private shouldSpawnSubAgent(step: PlanStep): boolean {
    // Spawn sub-agent for research-heavy steps
    const researchKeywords = ['research', 'find', 'search', 'analyze', 'compare']
    return researchKeywords.some((keyword) =>
      step.description.toLowerCase().includes(keyword)
    )
  }

  private getSubAgentTools(step: PlanStep): Record<string, any> {
    // Sub-agents get limited, read-only tools
    const safeTools = ['webSearch', 'readFile']
    const toolSubset = {}

    safeTools.forEach((toolName) => {
      if (this.tools[toolName]) {
        toolSubset[toolName] = this.tools[toolName]
      }
    })

    return toolSubset
  }

  private async generateResponse(plan: Plan): Promise<string> {
    // Synthesize results from all steps
    const results = plan.steps
      .map((step) => `${step.description}: ${JSON.stringify(step.result)}`)
      .join('\n')

    // Use LLM to create final response
    const { text } = await this.model.generateText({
      model: this.model,
      prompt: `
Based on the execution plan and results, provide a comprehensive response:

Objective: ${plan.objective}

Results:
${results}

Synthesize this into a clear, helpful response for the user.
      `,
    })

    return text
  }
}

// ============================================================================
// TOOLS DEFINITION
// ============================================================================

const tools = {
  webSearch: tool({
    description: 'Search the web for current information',
    parameters: z.object({
      query: z.string().describe('The search query'),
      maxResults: z.number().optional().describe('Maximum results to return'),
    }),
    execute: async ({ query, maxResults = 5 }) => {
      console.log(`[Tool:webSearch] Query: ${query}`)
      // Implement web search (use real API in production)
      return {
        results: [
          { title: 'Example Result 1', url: 'https://example.com/1' },
          { title: 'Example Result 2', url: 'https://example.com/2' },
        ],
      }
    },
  }),

  readFile: tool({
    description: 'Read contents of a file',
    parameters: z.object({
      path: z.string().describe('File path to read'),
    }),
    execute: async ({ path }) => {
      console.log(`[Tool:readFile] Path: ${path}`)
      // Implement file reading
      return { content: 'File content here...' }
    },
  }),

  writeFile: tool({
    description: 'Write content to a file',
    parameters: z.object({
      path: z.string().describe('File path to write'),
      content: z.string().describe('Content to write'),
    }),
    needsApproval: true, // Requires human approval
    execute: async ({ path, content }) => {
      console.log(`[Tool:writeFile] Path: ${path}`)
      // Implement file writing
      return { success: true, path }
    },
  }),

  apiCall: tool({
    description: 'Make HTTP API calls',
    parameters: z.object({
      url: z.string().describe('API endpoint URL'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
      body: z.any().optional(),
    }),
    execute: async ({ url, method, body }) => {
      console.log(`[Tool:apiCall] ${method} ${url}`)
      // Implement API call
      return { status: 200, data: {} }
    },
  }),
}

// ============================================================================
// TYPES
// ============================================================================

interface AgentResponse {
  success: boolean
  response: string
  plan: Plan | null
  executionHistory: ExecutionRecord[]
}

interface StepResult {
  success: boolean
  data?: any
  error?: string
  duration: number
}

interface VerificationResult {
  isValid: boolean
  confidence: number
  issues?: string[]
  suggestedFix?: string
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

async function main() {
  const agent = new MainAgent({
    model: anthropic('claude-sonnet-4-20250514'),
    tools,
  })

  // Example 1: Simple task
  console.log('\n\n=== EXAMPLE 1: Simple Task ===')
  const result1 = await agent.execute("What's 2+2?")
  console.log('Response:', result1.response)

  // Example 2: Complex task with planning
  console.log('\n\n=== EXAMPLE 2: Complex Task ===')
  const result2 = await agent.execute(
    'Research the top 3 TypeScript frameworks, ' +
    'compare their features, and create a summary'
  )
  console.log('Response:', result2.response)
  console.log('Plan:', JSON.stringify(result2.plan, null, 2))
}

// Uncomment to run
// main().catch(console.error)

export {
  MainAgent,
  PlanningSystem,
  ExecutionEngine,
  SubAgent,
  ContextManager,
  VerificationSystem,
  tools,
}
