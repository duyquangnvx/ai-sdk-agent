import type { LanguageModelV1 } from 'ai';

/**
 * Model selection criteria
 */
export interface ModelSelectionCriteria {
  /** Task complexity (0-10) */
  complexity?: number;
  /** Estimated input tokens */
  inputTokens?: number;
  /** Whether speed is priority */
  prioritizeSpeed?: boolean;
  /** Whether cost is priority */
  prioritizeCost?: boolean;
  /** Required capabilities */
  capabilities?: string[];
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Model option configuration
 */
export interface ModelOption {
  /** Model instance */
  model: LanguageModelV1;
  /** Display name */
  name: string;
  /** Provider (anthropic, openai, etc.) */
  provider: string;
  /** Max tokens supported */
  maxTokens?: number;
  /** Relative cost (1-10, higher = more expensive) */
  costRating?: number;
  /** Relative speed (1-10, higher = faster) */
  speedRating?: number;
  /** Supported capabilities */
  capabilities?: string[];
  /** When to prefer this model */
  preferWhen?: (criteria: ModelSelectionCriteria) => boolean;
}

/**
 * Model selector for dynamic model selection
 * Allows choosing models based on task characteristics
 */
export class ModelSelector {
  private models: Map<string, ModelOption> = new Map();
  private defaultModel?: string;

  /**
   * Register a model option
   */
  register(id: string, option: ModelOption): void {
    this.models.set(id, option);
  }

  /**
   * Set the default model
   */
  setDefault(id: string): void {
    if (!this.models.has(id)) {
      throw new Error(`Model "${id}" is not registered`);
    }
    this.defaultModel = id;
  }

  /**
   * Get a model by ID
   */
  get(id: string): LanguageModelV1 | undefined {
    return this.models.get(id)?.model;
  }

  /**
   * Get model options by ID
   */
  getOptions(id: string): ModelOption | undefined {
    return this.models.get(id);
  }

  /**
   * Get the default model
   */
  getDefault(): LanguageModelV1 | undefined {
    if (!this.defaultModel) return undefined;
    return this.get(this.defaultModel);
  }

  /**
   * Select the best model based on criteria
   */
  select(criteria: ModelSelectionCriteria): LanguageModelV1 {
    // First, check for models with preferWhen conditions
    for (const [, option] of this.models) {
      if (option.preferWhen?.(criteria)) {
        return option.model;
      }
    }

    // Score-based selection
    let bestModel: ModelOption | undefined;
    let bestScore = -Infinity;

    for (const [, option] of this.models) {
      const score = this.calculateScore(option, criteria);
      if (score > bestScore) {
        bestScore = score;
        bestModel = option;
      }
    }

    if (bestModel) {
      return bestModel.model;
    }

    // Fall back to default
    const defaultModel = this.getDefault();
    if (defaultModel) {
      return defaultModel;
    }

    throw new Error('No model available for selection');
  }

  /**
   * Select model for simple/fast tasks
   */
  selectFast(): LanguageModelV1 {
    return this.select({ prioritizeSpeed: true, complexity: 2 });
  }

  /**
   * Select model for complex tasks
   */
  selectComplex(): LanguageModelV1 {
    return this.select({ complexity: 8 });
  }

  /**
   * Select model for cost-effective tasks
   */
  selectCheap(): LanguageModelV1 {
    return this.select({ prioritizeCost: true });
  }

  /**
   * Get all registered model IDs
   */
  getModelIds(): string[] {
    return Array.from(this.models.keys());
  }

  /**
   * Calculate a score for a model based on criteria
   */
  private calculateScore(option: ModelOption, criteria: ModelSelectionCriteria): number {
    let score = 0;

    // Complexity matching
    if (criteria.complexity !== undefined) {
      // Higher complexity = prefer more capable models (higher cost usually)
      if (criteria.complexity >= 7 && option.costRating && option.costRating >= 7) {
        score += 30; // Prefer expensive/capable models for complex tasks
      } else if (criteria.complexity <= 3 && option.costRating && option.costRating <= 3) {
        score += 30; // Prefer cheap/fast models for simple tasks
      }
    }

    // Speed priority
    if (criteria.prioritizeSpeed && option.speedRating) {
      score += option.speedRating * 5;
    }

    // Cost priority
    if (criteria.prioritizeCost && option.costRating) {
      score += (10 - option.costRating) * 5; // Invert: lower cost = higher score
    }

    // Capability matching
    if (criteria.capabilities && option.capabilities) {
      const matchedCapabilities = criteria.capabilities.filter((cap) =>
        option.capabilities?.includes(cap)
      );
      score += matchedCapabilities.length * 10;
    }

    // Token capacity
    if (criteria.inputTokens && option.maxTokens) {
      if (option.maxTokens >= criteria.inputTokens) {
        score += 10;
      } else {
        score -= 50; // Penalize if model can't handle input
      }
    }

    return score;
  }
}

/**
 * Create a pre-configured model selector
 */
export function createModelSelector(): ModelSelector {
  return new ModelSelector();
}
