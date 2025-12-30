import type { Tool } from 'ai';
import type { z } from 'zod';

/**
 * Re-export useful AI SDK types
 * Users can import these directly from ai-sdk-agent instead of 'ai'
 */
export type { Tool } from 'ai';

/**
 * Tool approval function - can be boolean or async function
 * Maps to AI SDK v6's needsApproval
 */
export type ToolApprovalConfig<TInput = unknown> =
  | boolean
  | ((input: TInput) => Promise<boolean> | boolean);

/**
 * Tool registration options
 */
export interface ToolRegistrationOptions {
  /** Tool name (used as identifier) */
  name: string;

  /** Tool definition from AI SDK */
  tool: Tool;

  /** Required permissions for this tool */
  permissions?: string[];

  /** Whether tool is available to sub-agents */
  availableToSubAgents?: boolean;

  /** Tool category for organization */
  category?: 'core' | 'file' | 'web' | 'custom';

  /** Description override (if different from tool's description) */
  description?: string;
}

/**
 * Tool permission configuration
 */
export interface ToolPermissionConfig {
  /** Tool name */
  tool: string;

  /** Required permission level */
  level: 'read' | 'write' | 'execute';

  /** Whether to require explicit user approval before execution */
  requireApproval?: boolean;

  /** Custom approval function */
  approvalFunction?: ToolApprovalFunction;
}

/**
 * Tool approval function type
 */
export type ToolApprovalFunction = (params: {
  toolName: string;
  input: unknown;
  context: ToolExecutionContext;
}) => Promise<boolean>;

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  /** Agent ID executing the tool */
  agentId: string;

  /** Whether this is a sub-agent */
  isSubAgent: boolean;

  /** Current step number */
  stepNumber: number;

  /** Parent agent ID (if sub-agent) */
  parentAgentId?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  /** Tool name */
  toolName: string;

  /** Tool input */
  input: unknown;

  /** Tool output */
  output: unknown;

  /** Execution duration in milliseconds */
  duration: number;

  /** Whether execution was successful */
  success: boolean;

  /** Error if execution failed */
  error?: Error;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Tool builder configuration
 */
export interface ToolBuilderConfig<TInput = unknown> {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** Input schema */
  inputSchema: z.ZodSchema<TInput>;

  /** Execute function */
  execute: (input: TInput) => Promise<unknown>;

  /**
   * Whether tool requires approval before execution
   * - true: always require approval
   * - false: never require approval (default)
   * - function: dynamic approval based on input
   *
   * Maps to AI SDK v6's needsApproval
   */
  needsApproval?: ToolApprovalConfig<TInput>;

  /** Permissions required */
  permissions?: string[];

  /** Available to sub-agents */
  availableToSubAgents?: boolean;

  /** Category */
  category?: ToolRegistrationOptions['category'];
}

/**
 * Tool registry snapshot for debugging
 */
export interface ToolRegistrySnapshot {
  /** All registered tools */
  tools: Map<string, ToolRegistrationOptions>;

  /** Permission configs */
  permissions: Map<string, ToolPermissionConfig>;

  /** Tools available to sub-agents */
  subAgentTools: string[];

  /** Tools by category */
  byCategory: Record<string, string[]>;
}
