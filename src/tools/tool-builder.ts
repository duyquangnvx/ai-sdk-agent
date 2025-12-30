import { tool } from 'ai';
import type { Tool } from 'ai';
import type { z } from 'zod';
import type {
  ToolRegistrationOptions,
  ToolBuilderConfig,
  ToolApprovalConfig,
} from '../types/tool.types.js';

/**
 * Fluent builder for creating tools
 * Provides a more ergonomic way to create tools with full configuration
 */
export class ToolBuilder<TInput = unknown, TOutput = unknown> {
  private config: Partial<ToolBuilderConfig<TInput>> = {};

  /**
   * Set tool name
   */
  name(name: string): this {
    this.config.name = name;
    return this;
  }

  /**
   * Set tool description
   */
  description(description: string): this {
    this.config.description = description;
    return this;
  }

  /**
   * Set input schema
   */
  schema<T extends z.ZodSchema>(schema: T): ToolBuilder<z.infer<T>, TOutput> {
    this.config.inputSchema = schema;
    return this as unknown as ToolBuilder<z.infer<T>, TOutput>;
  }

  /**
   * Set execute function
   */
  execute<T>(fn: (input: TInput) => Promise<T>): ToolBuilder<TInput, T> {
    this.config.execute = fn as (input: unknown) => Promise<unknown>;
    return this as unknown as ToolBuilder<TInput, T>;
  }

  /**
   * Set required permissions
   */
  permissions(permissions: string[]): this {
    this.config.permissions = permissions;
    return this;
  }

  /**
   * Set whether tool is available to sub-agents
   */
  availableToSubAgents(available: boolean): this {
    this.config.availableToSubAgents = available;
    return this;
  }

  /**
   * Set tool category
   */
  category(category: ToolRegistrationOptions['category']): this {
    this.config.category = category;
    return this;
  }

  /**
   * Set whether tool requires approval before execution
   * Maps to AI SDK v6's needsApproval
   *
   * @param approval - true, false, or a function that returns boolean
   * @example
   * // Always require approval
   * .needsApproval(true)
   *
   * // Dynamic approval based on input
   * .needsApproval(async ({ amount }) => amount > 1000)
   */
  needsApproval(approval: ToolApprovalConfig<TInput>): this {
    this.config.needsApproval = approval;
    return this;
  }

  /**
   * Build the tool (AI SDK Tool)
   */
  buildTool(): Tool {
    this.validate();

    return tool({
      description: this.config.description!,
      inputSchema: this.config.inputSchema!,
      execute: this.config.execute as (input: unknown) => Promise<unknown>,
      needsApproval: this.config.needsApproval as ToolApprovalConfig<unknown>,
    });
  }

  /**
   * Build full registration options
   */
  build(): ToolRegistrationOptions {
    this.validate();

    return {
      name: this.config.name!,
      tool: this.buildTool(),
      permissions: this.config.permissions,
      availableToSubAgents: this.config.availableToSubAgents ?? true,
      category: this.config.category ?? 'custom',
    };
  }

  /**
   * Validate configuration
   */
  private validate(): void {
    if (!this.config.name) {
      throw new Error('Tool name is required');
    }
    if (!this.config.description) {
      throw new Error('Tool description is required');
    }
    if (!this.config.inputSchema) {
      throw new Error('Tool input schema is required');
    }
    if (!this.config.execute) {
      throw new Error('Tool execute function is required');
    }
  }
}

/**
 * Create a new tool builder
 */
export function createToolBuilder(): ToolBuilder {
  return new ToolBuilder();
}

/**
 * Quick tool creation helper
 *
 * @example
 * // Basic tool
 * const myTool = createTool({
 *   name: 'myTool',
 *   description: 'Does something',
 *   schema: z.object({ input: z.string() }),
 *   execute: async ({ input }) => ({ result: input }),
 * });
 *
 * // Tool with approval
 * const dangerousTool = createTool({
 *   name: 'deleteFile',
 *   description: 'Delete a file',
 *   schema: z.object({ path: z.string() }),
 *   execute: async ({ path }) => { ... },
 *   needsApproval: true, // Always require approval
 * });
 *
 * // Tool with dynamic approval
 * const paymentTool = createTool({
 *   name: 'payment',
 *   description: 'Process payment',
 *   schema: z.object({ amount: z.number() }),
 *   execute: async ({ amount }) => { ... },
 *   needsApproval: async ({ amount }) => amount > 1000, // Only for large amounts
 * });
 */
export function createTool<TInput, TOutput>(
  config: {
    name: string;
    description: string;
    schema: z.ZodSchema<TInput>;
    execute: (input: TInput) => Promise<TOutput>;
    /**
     * Whether tool requires approval before execution
     * - true: always require approval
     * - false: never require approval (default)
     * - function: dynamic approval based on input
     */
    needsApproval?: ToolApprovalConfig<TInput>;
    permissions?: string[];
    availableToSubAgents?: boolean;
    category?: ToolRegistrationOptions['category'];
  }
): ToolRegistrationOptions {
  return {
    name: config.name,
    tool: tool({
      description: config.description,
      inputSchema: config.schema as z.ZodSchema,
      execute: config.execute as (input: unknown) => Promise<unknown>,
      needsApproval: config.needsApproval as ToolApprovalConfig<unknown>,
    }) as Tool,
    permissions: config.permissions,
    availableToSubAgents: config.availableToSubAgents ?? true,
    category: config.category ?? 'custom',
  };
}
