import type { Tool } from 'ai';
import type {
  ToolRegistrationOptions,
  ToolPermissionConfig,
  ToolRegistrySnapshot,
} from '../types/tool.types.js';

/**
 * Central registry for agent tools
 * Manages tool registration, permissions, and access control
 */
export class ToolRegistry {
  private tools: Map<string, ToolRegistrationOptions> = new Map();
  private permissions: Map<string, ToolPermissionConfig> = new Map();

  /**
   * Register a tool
   */
  register(options: ToolRegistrationOptions): void {
    // Validate tool name
    if (!options.name || typeof options.name !== 'string') {
      throw new Error('Tool name is required and must be a string');
    }

    // Check for duplicate
    if (this.tools.has(options.name)) {
      console.warn(`Tool "${options.name}" already registered. Overwriting...`);
    }

    // Store tool with defaults
    this.tools.set(options.name, {
      ...options,
      availableToSubAgents: options.availableToSubAgents ?? true,
      category: options.category ?? 'custom',
    });
  }

  /**
   * Register multiple tools at once
   */
  registerMany(toolsMap: Record<string, Tool>, defaults?: Partial<ToolRegistrationOptions>): void {
    for (const [name, tool] of Object.entries(toolsMap)) {
      this.register({
        name,
        tool,
        ...defaults,
      });
    }
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    const deleted = this.tools.delete(name);
    this.permissions.delete(name);
    return deleted;
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name)?.tool;
  }

  /**
   * Get tool registration options
   */
  getOptions(name: string): ToolRegistrationOptions | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools as a record
   */
  getAll(): Record<string, Tool> {
    const result: Record<string, Tool> = {};
    for (const [name, options] of this.tools) {
      result[name] = options.tool;
    }
    return result;
  }

  /**
   * Get all tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tools filtered for sub-agent access
   */
  getToolsForSubAgent(): Record<string, Tool> {
    const result: Record<string, Tool> = {};
    for (const [name, options] of this.tools) {
      if (options.availableToSubAgents) {
        result[name] = options.tool;
      }
    }
    return result;
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolRegistrationOptions['category']): Record<string, Tool> {
    const result: Record<string, Tool> = {};
    for (const [name, options] of this.tools) {
      if (options.category === category) {
        result[name] = options.tool;
      }
    }
    return result;
  }

  /**
   * Filter tools by allowed names
   */
  filterByNames(allowedNames: string[]): Record<string, Tool> {
    const result: Record<string, Tool> = {};
    for (const name of allowedNames) {
      const options = this.tools.get(name);
      if (options) {
        result[name] = options.tool;
      }
    }
    return result;
  }

  /**
   * Set permission configuration for a tool
   */
  setPermission(toolName: string, config: Omit<ToolPermissionConfig, 'tool'>): void {
    if (!this.tools.has(toolName)) {
      throw new Error(`Cannot set permission for unregistered tool: ${toolName}`);
    }
    this.permissions.set(toolName, { ...config, tool: toolName });
  }

  /**
   * Get permission configuration for a tool
   */
  getPermission(toolName: string): ToolPermissionConfig | undefined {
    return this.permissions.get(toolName);
  }

  /**
   * Check if tool requires permission/approval
   */
  requiresApproval(toolName: string): boolean {
    const permission = this.permissions.get(toolName);
    return permission?.requireApproval ?? false;
  }

  /**
   * Get all tools that require approval
   */
  getToolsRequiringApproval(): string[] {
    const result: string[] = [];
    for (const [name, config] of this.permissions) {
      if (config.requireApproval) {
        result.push(name);
      }
    }
    return result;
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
    this.permissions.clear();
  }

  /**
   * Get registry snapshot for debugging
   */
  getSnapshot(): ToolRegistrySnapshot {
    const byCategory: Record<string, string[]> = {};

    for (const [name, options] of this.tools) {
      const category = options.category ?? 'custom';
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(name);
    }

    return {
      tools: new Map(this.tools),
      permissions: new Map(this.permissions),
      subAgentTools: this.getNames().filter((name) => this.tools.get(name)?.availableToSubAgents),
      byCategory,
    };
  }

  /**
   * Get tool count
   */
  get size(): number {
    return this.tools.size;
  }
}
