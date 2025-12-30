import type { LanguageModel, ModelMessage, Tool } from 'ai';
import type { z } from 'zod';
import type { ContextConfig, ConversationHistory } from './context.types.js';

/**
 * Core agent configuration
 */
export interface AgentConfig<TCallOptions = unknown> {
  /** Model to use - can be string ID or LanguageModel instance */
  model: string | LanguageModel;

  /** Agent name for logging and identification */
  name?: string;

  /** System prompt / base instructions */
  systemPrompt?: string;

  /** Custom instructions (like CLAUDE.md) - can be string or async loader */
  instructions?: string | InstructionsLoader;

  /** Tools available to the agent */
  tools?: Record<string, Tool>;

  /** Context management configuration */
  context?: ContextConfig;

  /** Feedback loop configuration */
  feedbackLoop?: FeedbackLoopConfig;

  /** Maximum execution steps before stopping */
  maxSteps?: number;

  /** Whether this agent can spawn sub-agents */
  canSpawnSubAgents?: boolean;

  /** Provider-specific settings */
  providerSettings?: Record<string, unknown>;

  /** Schema for runtime call options */
  callOptionsSchema?: z.ZodSchema<TCallOptions>;

  /** Function to prepare each call with dynamic configuration */
  prepareCall?: PrepareCallFunction<TCallOptions>;

  /** Callback when agent starts */
  onStart?: AgentLifecycleCallback;

  /** Callback when agent completes */
  onComplete?: AgentLifecycleCallback;

  /** Callback on each step */
  onStep?: StepCallback;

  /** Callback on error */
  onError?: ErrorCallback;
}

/**
 * Sub-agent specific configuration
 */
export interface SubAgentConfig<TCallOptions = unknown>
  extends Omit<AgentConfig<TCallOptions>, 'canSpawnSubAgents'> {
  /** Parent agent ID */
  parentAgentId: string;

  /** Allowed tools (subset of parent's tools) */
  allowedTools?: string[];

  /** Task description for the sub-agent */
  task: string;

  /** Maximum steps (typically lower than main agent) */
  maxSteps?: number;
}

/**
 * Instructions loader function type
 */
export type InstructionsLoader = () => Promise<string> | string;

/**
 * Prepare call function for dynamic configuration
 */
export type PrepareCallFunction<TCallOptions = unknown> = (params: {
  options?: TCallOptions;
  model: string | LanguageModel;
  tools?: Record<string, Tool>;
  systemPrompt?: string;
  maxSteps?: number;
}) => Promise<Partial<AgentConfig<TCallOptions>>> | Partial<AgentConfig<TCallOptions>>;

/**
 * Feedback loop configuration
 */
export interface FeedbackLoopConfig {
  /** Enable automatic verification after each step */
  enabled?: boolean;

  /** Verification strategies to apply */
  verificationStrategies?: VerificationStrategyType[];

  /** Maximum retry attempts on failure */
  maxRetries?: number;

  /** Delay between retries in milliseconds */
  retryDelay?: number;

  /** Custom verification function */
  customVerifier?: VerifierFunction;
}

/**
 * Built-in verification strategy types
 */
export type VerificationStrategyType =
  | 'output-validation'
  | 'error-checking'
  | 'state-consistency'
  | 'custom';

/**
 * Custom verifier function type
 */
export type VerifierFunction = (
  step: AgentStep,
  context: ConversationHistory
) => Promise<VerificationResult>;

/**
 * Verification result
 */
export interface VerificationResult {
  /** Whether verification passed */
  passed: boolean;

  /** Error/failure message */
  message?: string;

  /** Suggested fix or action */
  suggestedFix?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Agent execution step
 */
export interface AgentStep {
  /** Step number (0-indexed) */
  stepNumber: number;

  /** Type of step */
  type: 'tool-call' | 'text-generation' | 'verification' | 'sub-agent';

  /** Step input */
  input: unknown;

  /** Step output */
  output: unknown;

  /** Step timestamp */
  timestamp: Date;

  /** Execution duration in milliseconds */
  duration?: number;

  /** Error if step failed */
  error?: Error;

  /** Tool name (if tool-call type) */
  toolName?: string;

  /** Sub-agent ID (if sub-agent type) */
  subAgentId?: string;
}

/**
 * Agent execution result
 */
export interface AgentResult<T = unknown> {
  /** Final result value */
  result: T;

  /** All execution steps */
  steps: AgentStep[];

  /** Total execution duration in milliseconds */
  totalDuration: number;

  /** Whether execution completed successfully */
  success: boolean;

  /** Error if execution failed */
  error?: Error;

  /** Final conversation history state */
  finalContext: ConversationHistory;

  /** Agent ID */
  agentId: string;

  /** Usage statistics */
  usage?: AgentUsageStats;
}

/**
 * Agent usage statistics
 */
export interface AgentUsageStats {
  /** Total input tokens */
  inputTokens: number;

  /** Total output tokens */
  outputTokens: number;

  /** Total tokens */
  totalTokens: number;

  /** Number of API calls */
  apiCalls: number;

  /** Number of tool calls */
  toolCalls: number;

  /** Number of sub-agent spawns */
  subAgentSpawns: number;
}

/**
 * Agent lifecycle callback
 */
export type AgentLifecycleCallback = (params: {
  agentId: string;
  config: AgentConfig;
  timestamp: Date;
}) => void | Promise<void>;

/**
 * Step callback
 */
export type StepCallback = (step: AgentStep) => void | Promise<void>;

/**
 * Error callback
 */
export type ErrorCallback = (params: {
  error: Error;
  step?: AgentStep;
  agentId: string;
}) => void | Promise<void>;

/**
 * Agent state for inspection/debugging
 */
export interface AgentState {
  /** Agent ID */
  id: string;

  /** Agent name */
  name?: string;

  /** Current status */
  status: 'idle' | 'running' | 'completed' | 'error';

  /** Current step number */
  currentStep: number;

  /** Execution steps so far */
  steps: AgentStep[];

  /** Context state */
  context: ConversationHistory;

  /** Active sub-agents */
  activeSubAgents: string[];

  /** Start timestamp */
  startedAt?: Date;

  /** Completion timestamp */
  completedAt?: Date;
}

/**
 * Options for agent.execute()
 */
export interface ExecuteOptions<TCallOptions = unknown> {
  /** Runtime call options (validated against callOptionsSchema) */
  options?: TCallOptions;

  /** Override system prompt for this execution */
  systemPrompt?: string;

  /** Additional context messages to prepend */
  contextMessages?: ModelMessage[];

  /** Override max steps for this execution */
  maxSteps?: number;

  /** Signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Options for spawning sub-agents
 */
export interface SpawnSubAgentOptions {
  /** Task description */
  task: string;

  /** Allowed tools (defaults to all sub-agent accessible tools) */
  allowedTools?: string[];

  /** Override model for sub-agent */
  model?: string | LanguageModel;

  /** Override system prompt */
  systemPrompt?: string;

  /** Max steps for sub-agent */
  maxSteps?: number;
}
