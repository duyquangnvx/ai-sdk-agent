/**
 * AI SDK Agent Library
 *
 * A flexible agent library inspired by Claude Code architecture,
 * built on AI SDK v6 with multi-provider support.
 *
 * @example
 * ```typescript
 * import { Agent } from 'ai-sdk-agent';
 * import { anthropic } from '@ai-sdk/anthropic';
 *
 * const agent = new Agent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   systemPrompt: 'You are a helpful assistant.',
 * });
 *
 * const result = await agent.execute('Help me with this task');
 * console.log(result.result);
 * ```
 */

// Core exports
export { Agent } from './core/agent.js';
export { SubAgent } from './core/sub-agent.js';

// Context management
export { ContextManager } from './context/context-manager.js';
export { ConversationHistoryManager } from './context/conversation-history.js';
export {
  InstructionsLoaderUtils,
  autoLoadInstructions,
  DEFAULT_INSTRUCTION_FILES,
} from './context/instructions-loader.js';

// Tool system
export { ToolRegistry } from './tools/tool-registry.js';
export { ToolBuilder, createToolBuilder, createTool } from './tools/tool-builder.js';

// Feedback loop
export { FeedbackLoop, createFeedbackLoop } from './feedback/feedback-loop.js';
export {
  type IVerificationStrategy,
  OutputValidationStrategy,
  ErrorCheckingStrategy,
  StateConsistencyStrategy,
  createVerificationStrategy,
} from './feedback/verification-strategy.js';

// Providers
export {
  ModelSelector,
  createModelSelector,
  type ModelSelectionCriteria,
  type ModelOption,
} from './providers/model-selector.js';

// Type exports
export type {
  // Re-exported AI SDK types (convenience)
  LanguageModel,
  ModelMessage,
  TextStreamPart,
  // Agent types
  ToolSet,
  AgentStreamPart,
  AgentConfig,
  SubAgentConfig,
  InstructionsLoader,
  PrepareCallFunction,
  FeedbackLoopConfig,
  VerificationStrategyType,
  VerifierFunction,
  VerificationResult,
  AgentStep,
  AgentResult,
  AgentUsageStats,
  AgentLifecycleCallback,
  StepCallback,
  ErrorCallback,
  AgentState,
  ExecuteOptions,
  SpawnSubAgentOptions,
} from './types/agent.types.js';

export type {
  // Context types
  ContextConfig,
  ConversationHistory,
  CompactionResult,
  CompactorFunction,
  TokenCounterFunction,
  ContextSnapshot,
} from './types/context.types.js';

export type {
  // Tool types
  Tool,
  ToolApprovalConfig,
  ToolRegistrationOptions,
  ToolPermissionConfig,
  ToolApprovalFunction,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolBuilderConfig,
  ToolRegistrySnapshot,
} from './types/tool.types.js';
