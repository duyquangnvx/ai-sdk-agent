import type { AgentResult, SubAgentConfig } from '../types/agent.types.js';
import { Agent } from './agent.js';

/**
 * SubAgent - A limited version of Agent
 *
 * Key restrictions (following Claude Code architecture):
 * - Cannot spawn additional sub-agents (max 1 level nesting)
 * - Has limited tool access (filtered by parent)
 * - Results return to parent agent as tool response
 */
export class SubAgent<TCallOptions = unknown> extends Agent<TCallOptions> {
  readonly parentAgentId: string;
  readonly task: string;

  constructor(config: SubAgentConfig<TCallOptions>) {
    // Force canSpawnSubAgents to false to enforce max 1 level nesting
    super({
      ...config,
      canSpawnSubAgents: false,
      maxSteps: config.maxSteps ?? 10, // Lower default for sub-agents
    });

    this.parentAgentId = config.parentAgentId;
    this.task = config.task;
  }

  /**
   * Override spawnSubAgent to prevent nesting
   */
  override async spawnSubAgent(): Promise<AgentResult> {
    throw new Error(
      'Sub-agents cannot spawn additional sub-agents. ' +
      'This restriction ensures max 1 level of agent nesting (Claude Code architecture).'
    );
  }

  /**
   * Execute the sub-agent's task
   */
  async executeTask(): Promise<AgentResult> {
    return this.execute(this.task);
  }

  /**
   * Get parent agent ID
   */
  getParentAgentId(): string {
    return this.parentAgentId;
  }

  /**
   * Get the task this sub-agent was created for
   */
  getTask(): string {
    return this.task;
  }

  /**
   * Check if this is a sub-agent
   */
  isSubAgent(): boolean {
    return true;
  }
}
