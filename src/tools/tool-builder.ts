import { tool } from 'ai';
import type { Tool } from 'ai';
import type { z } from 'zod';
import type { ToolRegistrationOptions, ToolBuilderConfig } from '../types/tool.types.js';

/**
 * Fluent builder for creating tools
 * Provides a more ergonomic way to create tools with full configuration
 */
export class ToolBuilder<TInput = unknown, TOutput = unknown> {
  private config: Partial<ToolBuilderConfig> = {};

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
   * Build the tool (AI SDK Tool)
   */
  buildTool(): Tool {
    this.validate();

    return tool({
      description: this.config.description!,
      inputSchema: this.config.inputSchema!,
      execute: this.config.execute!,
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
 */
export function createTool<TInput, TOutput>(
  config: {
    name: string;
    description: string;
    schema: z.ZodSchema<TInput>;
    execute: (input: TInput) => Promise<TOutput>;
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
    }) as Tool,
    permissions: config.permissions,
    availableToSubAgents: config.availableToSubAgents ?? true,
    category: config.category ?? 'custom',
  };
}
