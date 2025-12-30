import { generateText, streamText, type LanguageModel, type ModelMessage, type Tool } from 'ai';
import { randomUUID } from 'crypto';
import type {
  AgentConfig,
  AgentResult,
  AgentStep,
  AgentState,
  AgentUsageStats,
  ExecuteOptions,
  SpawnSubAgentOptions,
} from '../types/agent.types.js';
import type { ConversationHistory } from '../types/context.types.js';
import { ContextManager } from '../context/context-manager.js';
import { ToolRegistry } from '../tools/tool-registry.js';

/**
 * Main Agent class - inspired by Claude Code architecture
 *
 * Features:
 * - Single-thread execution model
 * - Sub-agent spawning (max 1 level)
 * - Context management with auto-compaction
 * - Tool registry and permissions
 * - Feedback loop for verification
 */
export class Agent<TCallOptions = unknown> {
  readonly id: string;
  protected config: AgentConfig<TCallOptions>;
  protected contextManager: ContextManager;
  protected toolRegistry: ToolRegistry;
  protected steps: AgentStep[] = [];
  protected status: AgentState['status'] = 'idle';
  protected usage: AgentUsageStats = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    apiCalls: 0,
    toolCalls: 0,
    subAgentSpawns: 0,
  };
  protected startedAt?: Date;
  protected completedAt?: Date;
  protected activeSubAgents: Set<string> = new Set();
  protected model: LanguageModel;

  constructor(config: AgentConfig<TCallOptions>) {
    this.id = randomUUID();
    this.config = this.normalizeConfig(config);
    this.contextManager = new ContextManager(config.context);
    this.toolRegistry = new ToolRegistry();
    this.model = this.resolveModel(config.model);

    // Register provided tools
    if (config.tools) {
      this.toolRegistry.registerMany(config.tools);
    }
  }

  /**
   * Execute agent with given input
   */
  async execute<T = unknown>(
    input: string,
    options?: ExecuteOptions<TCallOptions>
  ): Promise<AgentResult<T>> {
    this.startedAt = new Date();
    this.status = 'running';
    this.steps = [];
    this.resetUsage();

    try {
      // Trigger onStart callback
      await this.config.onStart?.({
        agentId: this.id,
        config: this.config as AgentConfig,
        timestamp: this.startedAt,
      });

      // Prepare execution configuration
      const execConfig = await this.prepareExecution(options);

      // Build system prompt
      const systemPrompt = await this.buildSystemPrompt(execConfig);

      // Add context messages if provided
      if (options?.contextMessages) {
        for (const msg of options.contextMessages) {
          this.contextManager.addMessage(msg);
        }
      }

      // Add user input
      this.contextManager.addUserMessage(input);

      // Execute the agent loop
      const result = await this.executeLoop(systemPrompt, execConfig, options?.signal);

      this.status = 'completed';
      this.completedAt = new Date();

      // Trigger onComplete callback
      await this.config.onComplete?.({
        agentId: this.id,
        config: this.config as AgentConfig,
        timestamp: this.completedAt,
      });

      return {
        result: result as T,
        steps: [...this.steps],
        totalDuration: this.completedAt.getTime() - this.startedAt.getTime(),
        success: true,
        finalContext: this.contextManager.getHistory(),
        agentId: this.id,
        usage: { ...this.usage },
      };
    } catch (error) {
      this.status = 'error';
      this.completedAt = new Date();

      // Trigger onError callback
      await this.config.onError?.({
        error: error as Error,
        agentId: this.id,
      });

      return {
        result: null as T,
        steps: [...this.steps],
        totalDuration: this.completedAt.getTime() - (this.startedAt?.getTime() ?? 0),
        success: false,
        error: error as Error,
        finalContext: this.contextManager.getHistory(),
        agentId: this.id,
        usage: { ...this.usage },
      };
    }
  }

  /**
   * Stream agent execution
   */
  async *stream(
    input: string,
    options?: ExecuteOptions<TCallOptions>
  ): AsyncGenerator<AgentStep, AgentResult> {
    this.startedAt = new Date();
    this.status = 'running';
    this.steps = [];
    this.resetUsage();

    try {
      await this.config.onStart?.({
        agentId: this.id,
        config: this.config as AgentConfig,
        timestamp: this.startedAt,
      });

      const execConfig = await this.prepareExecution(options);
      const systemPrompt = await this.buildSystemPrompt(execConfig);

      if (options?.contextMessages) {
        for (const msg of options.contextMessages) {
          this.contextManager.addMessage(msg);
        }
      }

      this.contextManager.addUserMessage(input);

      // Execute with streaming
      for await (const step of this.executeLoopStreaming(systemPrompt, execConfig, options?.signal)) {
        this.steps.push(step);
        yield step;
      }

      this.status = 'completed';
      this.completedAt = new Date();

      await this.config.onComplete?.({
        agentId: this.id,
        config: this.config as AgentConfig,
        timestamp: this.completedAt,
      });

      return {
        result: this.steps[this.steps.length - 1]?.output,
        steps: [...this.steps],
        totalDuration: this.completedAt.getTime() - this.startedAt.getTime(),
        success: true,
        finalContext: this.contextManager.getHistory(),
        agentId: this.id,
        usage: { ...this.usage },
      };
    } catch (error) {
      this.status = 'error';
      this.completedAt = new Date();

      await this.config.onError?.({
        error: error as Error,
        agentId: this.id,
      });

      return {
        result: null,
        steps: [...this.steps],
        totalDuration: this.completedAt.getTime() - (this.startedAt?.getTime() ?? 0),
        success: false,
        error: error as Error,
        finalContext: this.contextManager.getHistory(),
        agentId: this.id,
        usage: { ...this.usage },
      };
    }
  }

  /**
   * Spawn a sub-agent for complex tasks
   */
  async spawnSubAgent(options: SpawnSubAgentOptions): Promise<AgentResult> {
    if (!this.config.canSpawnSubAgents) {
      throw new Error('This agent is not allowed to spawn sub-agents');
    }

    // Import SubAgent dynamically to avoid circular dependency
    const { SubAgent } = await import('./sub-agent.js');

    const subAgentId = randomUUID();
    this.activeSubAgents.add(subAgentId);
    this.usage.subAgentSpawns++;

    try {
      // Create sub-agent with limited capabilities
      const subAgent = new SubAgent({
        parentAgentId: this.id,
        task: options.task,
        model: options.model ?? this.config.model,
        systemPrompt: options.systemPrompt ?? this.buildSubAgentPrompt(options.task),
        tools: this.getSubAgentTools(options.allowedTools),
        maxSteps: options.maxSteps ?? 10,
        context: this.config.context,
      });

      // Execute sub-agent
      const result = await subAgent.execute(options.task);

      // Record as a step
      const step: AgentStep = {
        stepNumber: this.steps.length,
        type: 'sub-agent',
        input: options.task,
        output: result.result,
        timestamp: new Date(),
        duration: result.totalDuration,
        subAgentId,
      };

      this.steps.push(step);
      await this.config.onStep?.(step);

      // Add sub-agent result to context
      this.contextManager.addAssistantMessage(
        `[Sub-agent completed task: "${options.task}"]\nResult: ${JSON.stringify(result.result)}`
      );

      return result;
    } finally {
      this.activeSubAgents.delete(subAgentId);
    }
  }

  /**
   * Register a tool
   */
  registerTool(name: string, tool: Parameters<ToolRegistry['register']>[0]['tool']): void {
    this.toolRegistry.register({ name, tool });
  }

  /**
   * Get conversation history
   */
  getHistory(): ConversationHistory {
    return this.contextManager.getHistory();
  }

  /**
   * Get execution steps
   */
  getSteps(): AgentStep[] {
    return [...this.steps];
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return {
      id: this.id,
      name: this.config.name,
      status: this.status,
      currentStep: this.steps.length,
      steps: [...this.steps],
      context: this.contextManager.getHistory(),
      activeSubAgents: Array.from(this.activeSubAgents),
      startedAt: this.startedAt,
      completedAt: this.completedAt,
    };
  }

  /**
   * Compact conversation history manually
   */
  async compactHistory() {
    return this.contextManager.compact();
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.contextManager.clear();
    this.steps = [];
  }

  // Protected methods for subclass access

  protected normalizeConfig(config: AgentConfig<TCallOptions>): AgentConfig<TCallOptions> {
    return {
      maxSteps: 20,
      canSpawnSubAgents: true,
      ...config,
      context: {
        maxTokens: 100000,
        compactThreshold: 0.8,
        compactStrategy: 'summarize',
        preserveSystem: true,
        ...config.context,
      },
      feedbackLoop: {
        enabled: false,
        maxRetries: 3,
        retryDelay: 1000,
        ...config.feedbackLoop,
      },
    };
  }

  protected resolveModel(model: string | LanguageModel): LanguageModel {
    if (typeof model === 'string') {
      throw new Error(
        `String model IDs are not directly supported. Please pass a LanguageModel instance from @ai-sdk/anthropic, @ai-sdk/openai, or another provider. Example: anthropic('claude-sonnet-4-20250514')`
      );
    }
    return model;
  }

  protected async prepareExecution(
    options?: ExecuteOptions<TCallOptions>
  ): Promise<Partial<AgentConfig<TCallOptions>>> {
    if (!this.config.prepareCall) {
      return {};
    }

    return this.config.prepareCall({
      options: options?.options,
      model: this.config.model,
      tools: this.toolRegistry.getAll(),
      systemPrompt: this.config.systemPrompt,
      maxSteps: options?.maxSteps ?? this.config.maxSteps,
    });
  }

  protected async buildSystemPrompt(execConfig: Partial<AgentConfig<TCallOptions>>): Promise<string> {
    const parts: string[] = [];

    // Base system prompt
    const systemPrompt = execConfig.systemPrompt ?? this.config.systemPrompt;
    if (systemPrompt) {
      parts.push(systemPrompt);
    }

    // Load instructions
    if (this.config.instructions) {
      const instructions =
        typeof this.config.instructions === 'function'
          ? await this.config.instructions()
          : this.config.instructions;
      if (instructions) {
        parts.push(instructions);
      }
    }

    return parts.join('\n\n');
  }

  protected async executeLoop(
    systemPrompt: string,
    execConfig: Partial<AgentConfig<TCallOptions>>,
    signal?: AbortSignal
  ): Promise<unknown> {
    const maxSteps = execConfig.maxSteps ?? this.config.maxSteps ?? 20;
    let currentStep = 0;
    let lastResult: unknown = null;

    while (currentStep < maxSteps) {
      if (signal?.aborted) {
        throw new Error('Agent execution aborted');
      }

      const stepStart = Date.now();

      // Check and compact context if needed
      await this.contextManager.checkAndCompact();

      // Get messages for API call
      const messages = this.contextManager.getMessages();

      // Make API call with tools
      const tools = this.toolRegistry.getAll();

      try {
        this.usage.apiCalls++;

        const response = await generateText({
          model: this.model,
          system: systemPrompt,
          messages,
          tools: Object.keys(tools).length > 0 ? tools : undefined,
          abortSignal: signal,
        });

        // Update usage
        if (response.usage) {
          this.usage.inputTokens += response.usage.inputTokens ?? 0;
          this.usage.outputTokens += response.usage.outputTokens ?? 0;
          this.usage.totalTokens += (response.usage.inputTokens ?? 0) + (response.usage.outputTokens ?? 0);
        }

        // Process response
        const hasToolCalls = response.toolCalls && response.toolCalls.length > 0;

        if (hasToolCalls) {
          // Record tool call steps
          const toolResults = response.toolResults as Array<{ toolCallId: string; toolName: string; output: unknown }> | undefined;

          for (const toolCall of response.toolCalls) {
            this.usage.toolCalls++;

            const step: AgentStep = {
              stepNumber: currentStep,
              type: 'tool-call',
              input: toolCall.input,
              output: toolResults?.find((r) => r.toolCallId === toolCall.toolCallId)?.output,
              timestamp: new Date(),
              duration: Date.now() - stepStart,
              toolName: toolCall.toolName,
            };

            this.steps.push(step);
            await this.config.onStep?.(step);
            currentStep++;
          }

          // Add response messages to context (properly formatted by AI SDK)
          for (const msg of response.response.messages) {
            this.contextManager.addMessage(msg as ModelMessage);
          }

          // Continue the loop
          lastResult = toolResults;
        } else {
          // Text generation step
          const step: AgentStep = {
            stepNumber: currentStep,
            type: 'text-generation',
            input: messages[messages.length - 1],
            output: response.text,
            timestamp: new Date(),
            duration: Date.now() - stepStart,
          };

          this.steps.push(step);
          await this.config.onStep?.(step);

          // Add response to context
          this.contextManager.addAssistantMessage(response.text);

          // No more tool calls = we're done
          lastResult = response.text;
          break;
        }
      } catch (error) {
        const step: AgentStep = {
          stepNumber: currentStep,
          type: 'tool-call',
          input: messages,
          output: null,
          timestamp: new Date(),
          duration: Date.now() - stepStart,
          error: error as Error,
        };

        this.steps.push(step);
        throw error;
      }
    }

    return lastResult;
  }

  protected async *executeLoopStreaming(
    systemPrompt: string,
    execConfig: Partial<AgentConfig<TCallOptions>>,
    signal?: AbortSignal
  ): AsyncGenerator<AgentStep> {
    const maxSteps = execConfig.maxSteps ?? this.config.maxSteps ?? 20;
    let currentStep = 0;

    while (currentStep < maxSteps) {
      if (signal?.aborted) {
        throw new Error('Agent execution aborted');
      }

      const stepStart = Date.now();
      await this.contextManager.checkAndCompact();

      const messages = this.contextManager.getMessages();
      const tools = this.toolRegistry.getAll();

      this.usage.apiCalls++;

      const response = streamText({
        model: this.model,
        system: systemPrompt,
        messages,
        tools: Object.keys(tools).length > 0 ? tools : undefined,
        abortSignal: signal,
      });

      let fullText = '';

      for await (const chunk of response.textStream) {
        fullText += chunk;
      }

      // Get final results - these are promises that need to be awaited
      const [usage, toolCallsResult, toolResultsResult] = await Promise.all([
        response.usage,
        response.toolCalls,
        response.toolResults,
      ]);

      if (usage) {
        this.usage.inputTokens += usage.inputTokens ?? 0;
        this.usage.outputTokens += usage.outputTokens ?? 0;
        this.usage.totalTokens += (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
      }

      if (toolCallsResult && toolCallsResult.length > 0) {
        const toolResults = toolResultsResult as Array<{ toolCallId: string; toolName: string; output: unknown }> | undefined;

        for (const toolCall of toolCallsResult) {
          this.usage.toolCalls++;

          const step: AgentStep = {
            stepNumber: currentStep,
            type: 'tool-call',
            input: toolCall.input,
            output: toolResults?.find((r) => r.toolCallId === toolCall.toolCallId)?.output,
            timestamp: new Date(),
            duration: Date.now() - stepStart,
            toolName: toolCall.toolName,
          };

          yield step;
          currentStep++;
        }

        // Add response messages to context (properly formatted by AI SDK)
        const responseObj = await response.response;
        for (const msg of responseObj.messages) {
          this.contextManager.addMessage(msg as ModelMessage);
        }
      } else {
        const step: AgentStep = {
          stepNumber: currentStep,
          type: 'text-generation',
          input: messages[messages.length - 1],
          output: fullText,
          timestamp: new Date(),
          duration: Date.now() - stepStart,
        };

        yield step;
        this.contextManager.addAssistantMessage(fullText);
        break;
      }
    }
  }

  protected buildSubAgentPrompt(task: string): string {
    return `You are a sub-agent helping to complete the following task:

${task}

You have limited capabilities and cannot spawn additional sub-agents.
Focus on completing this specific task and returning results to the parent agent.
Be concise and efficient in your responses.`;
  }

  protected getSubAgentTools(allowedTools?: string[]): Record<string, Tool> {
    if (allowedTools) {
      return this.toolRegistry.filterByNames(allowedTools);
    }
    return this.toolRegistry.getToolsForSubAgent();
  }

  protected resetUsage(): void {
    this.usage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      apiCalls: 0,
      toolCalls: 0,
      subAgentSpawns: 0,
    };
  }
}
