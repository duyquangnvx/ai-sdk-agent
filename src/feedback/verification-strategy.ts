import type {
  AgentStep,
  VerificationResult,
  VerificationStrategyType,
} from '../types/agent.types.js';
import type { ConversationHistory } from '../types/context.types.js';

/**
 * Base verification strategy interface
 */
export interface IVerificationStrategy {
  readonly type: VerificationStrategyType;
  verify(step: AgentStep, context: ConversationHistory): Promise<VerificationResult>;
}

/**
 * Output validation strategy
 * Checks if the output is valid (not null, not error)
 */
export class OutputValidationStrategy implements IVerificationStrategy {
  readonly type: VerificationStrategyType = 'output-validation';

  async verify(step: AgentStep): Promise<VerificationResult> {
    // Check if step has an error
    if (step.error) {
      return {
        passed: false,
        message: `Step failed with error: ${step.error.message}`,
        suggestedFix: 'Review the error and retry with different parameters',
      };
    }

    // Check if output is null/undefined
    if (step.output === null || step.output === undefined) {
      return {
        passed: false,
        message: 'Step produced no output',
        suggestedFix: 'Ensure the tool or action returns a value',
      };
    }

    return { passed: true };
  }
}

/**
 * Error checking strategy
 * Looks for error patterns in the output
 */
export class ErrorCheckingStrategy implements IVerificationStrategy {
  readonly type: VerificationStrategyType = 'error-checking';

  private errorPatterns = [
    /error/i,
    /exception/i,
    /failed/i,
    /failure/i,
    /invalid/i,
    /cannot/i,
    /unable to/i,
  ];

  async verify(step: AgentStep): Promise<VerificationResult> {
    // Check for error in step
    if (step.error) {
      return {
        passed: false,
        message: `Step error: ${step.error.message}`,
        suggestedFix: 'Address the error before proceeding',
      };
    }

    // Check output for error patterns
    const outputStr = this.stringifyOutput(step.output);

    for (const pattern of this.errorPatterns) {
      if (pattern.test(outputStr)) {
        // Not all matches are actual errors, so we do a softer check
        // Only fail if it looks like an actual error message
        if (this.looksLikeError(outputStr)) {
          return {
            passed: false,
            message: `Potential error detected in output: ${outputStr.slice(0, 200)}`,
            suggestedFix: 'Review the output and determine if this is an actual error',
            metadata: { pattern: pattern.toString() },
          };
        }
      }
    }

    return { passed: true };
  }

  private stringifyOutput(output: unknown): string {
    if (typeof output === 'string') return output;
    if (output === null || output === undefined) return '';
    try {
      return JSON.stringify(output);
    } catch {
      return String(output);
    }
  }

  private looksLikeError(text: string): boolean {
    // More specific error indicators
    const strongErrorPatterns = [
      /\bError:\s/i,
      /\bException:\s/i,
      /\bFailed:\s/i,
      /stack trace/i,
      /at\s+\w+\s+\(/i, // Stack trace pattern
    ];

    return strongErrorPatterns.some((p) => p.test(text));
  }
}

/**
 * State consistency strategy
 * Verifies that the step maintains expected state
 */
export class StateConsistencyStrategy implements IVerificationStrategy {
  readonly type: VerificationStrategyType = 'state-consistency';

  async verify(step: AgentStep, context: ConversationHistory): Promise<VerificationResult> {
    // Basic consistency checks

    // 1. Check step number is sequential
    // This is a sanity check - step numbers should be sequential

    // 2. Check context is not empty after operations
    if (context.messages.length === 0) {
      return {
        passed: false,
        message: 'Context is empty after step execution',
        suggestedFix: 'Ensure steps are properly updating the conversation history',
      };
    }

    // 3. For tool calls, verify tool name is present
    if (step.type === 'tool-call' && !step.toolName) {
      return {
        passed: false,
        message: 'Tool call step missing tool name',
        suggestedFix: 'Ensure tool calls include the tool name',
      };
    }

    return { passed: true };
  }
}

/**
 * Create a verification strategy by type
 */
export function createVerificationStrategy(type: VerificationStrategyType): IVerificationStrategy {
  switch (type) {
    case 'output-validation':
      return new OutputValidationStrategy();
    case 'error-checking':
      return new ErrorCheckingStrategy();
    case 'state-consistency':
      return new StateConsistencyStrategy();
    case 'custom':
      throw new Error('Custom strategy requires a custom implementation');
    default:
      throw new Error(`Unknown verification strategy type: ${type}`);
  }
}
