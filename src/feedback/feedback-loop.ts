import type {
  AgentStep,
  FeedbackLoopConfig,
  VerificationResult,
  VerifierFunction,
} from '../types/agent.types.js';
import type { ConversationHistory } from '../types/context.types.js';
import {
  type IVerificationStrategy,
  createVerificationStrategy,
} from './verification-strategy.js';

/**
 * Default feedback loop configuration
 */
const DEFAULT_CONFIG: Required<Omit<FeedbackLoopConfig, 'customVerifier'>> = {
  enabled: true,
  verificationStrategies: ['output-validation', 'error-checking'],
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * Feedback loop implementation
 * Implements the pattern: Gather → Action → Verify → Repeat
 */
export class FeedbackLoop {
  private config: FeedbackLoopConfig;
  private strategies: IVerificationStrategy[];

  constructor(config?: FeedbackLoopConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.strategies = this.initializeStrategies();
  }

  /**
   * Check if feedback loop is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled ?? true;
  }

  /**
   * Get configuration
   */
  getConfig(): FeedbackLoopConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FeedbackLoopConfig>): void {
    this.config = { ...this.config, ...config };
    this.strategies = this.initializeStrategies();
  }

  /**
   * Verify a step
   */
  async verify(
    step: AgentStep,
    context: ConversationHistory
  ): Promise<VerificationResult> {
    // If custom verifier is provided, use it
    if (this.config.customVerifier) {
      return this.config.customVerifier(step, context);
    }

    // Run all verification strategies
    for (const strategy of this.strategies) {
      const result = await strategy.verify(step, context);
      if (!result.passed) {
        return result;
      }
    }

    return { passed: true };
  }

  /**
   * Execute a function with retry logic
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    createStep: (result: T, attempt: number) => AgentStep,
    context: ConversationHistory
  ): Promise<{ result: T; attempts: number; finalStep: AgentStep }> {
    const maxRetries = this.config.maxRetries ?? DEFAULT_CONFIG.maxRetries;
    const retryDelay = this.config.retryDelay ?? DEFAULT_CONFIG.retryDelay;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await fn();

        // Create step for verification
        const step = createStep(result, attempt);

        // Verify if enabled
        if (this.isEnabled()) {
          const verification = await this.verify(step, context);

          if (verification.passed) {
            return { result, attempts: attempt + 1, finalStep: step };
          }

          // Verification failed
          console.warn(
            `Verification failed on attempt ${attempt + 1}: ${verification.message}`
          );

          // If we have more retries, wait and try again
          if (attempt < maxRetries - 1) {
            await this.delay(retryDelay);
            continue;
          }

          // No more retries, throw
          throw new Error(
            `Verification failed after ${maxRetries} attempts: ${verification.message}`
          );
        }

        // Feedback loop disabled, return immediately
        return { result, attempts: attempt + 1, finalStep: step };
      } catch (error) {
        lastError = error as Error;

        // If we have more retries, wait and try again
        if (attempt < maxRetries - 1) {
          console.warn(`Attempt ${attempt + 1} failed: ${lastError.message}. Retrying...`);
          await this.delay(retryDelay);
          continue;
        }
      }
    }

    // All retries exhausted
    throw lastError ?? new Error(`Execution failed after ${maxRetries} attempts`);
  }

  /**
   * Create a retry wrapper for async functions
   */
  wrapWithRetry<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>
  ): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs): Promise<TResult> => {
      const maxRetries = this.config.maxRetries ?? DEFAULT_CONFIG.maxRetries;
      const retryDelay = this.config.retryDelay ?? DEFAULT_CONFIG.retryDelay;

      let lastError: Error | undefined;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await fn(...args);
        } catch (error) {
          lastError = error as Error;
          if (attempt < maxRetries - 1) {
            await this.delay(retryDelay);
          }
        }
      }

      throw lastError ?? new Error(`Function failed after ${maxRetries} retries`);
    };
  }

  /**
   * Initialize verification strategies from config
   */
  private initializeStrategies(): IVerificationStrategy[] {
    const strategyTypes = this.config.verificationStrategies ?? DEFAULT_CONFIG.verificationStrategies;

    return strategyTypes
      .filter((type) => type !== 'custom') // Skip custom, handled separately
      .map((type) => createVerificationStrategy(type));
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a feedback loop with custom verifier
 */
export function createFeedbackLoop(
  customVerifier: VerifierFunction,
  config?: Omit<FeedbackLoopConfig, 'customVerifier'>
): FeedbackLoop {
  return new FeedbackLoop({
    ...config,
    customVerifier,
  });
}
