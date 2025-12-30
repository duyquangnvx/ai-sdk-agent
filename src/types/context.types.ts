import type { CoreMessage } from 'ai';

/**
 * Context management configuration
 */
export interface ContextConfig {
  /** Maximum context window size in tokens */
  maxTokens?: number;

  /** Auto-compact when reaching this threshold (0-1, e.g., 0.8 = 80%) */
  compactThreshold?: number;

  /** Strategy for compacting conversation history */
  compactStrategy?: 'summarize' | 'truncate' | 'sliding-window';

  /** Whether to preserve system messages during compaction */
  preserveSystem?: boolean;

  /** Custom compactor function */
  customCompactor?: CompactorFunction;

  /** Model to use for summarization (if using summarize strategy) */
  summaryModel?: string;
}

/**
 * Conversation history interface
 */
export interface ConversationHistory {
  /** All messages in the conversation */
  messages: CoreMessage[];

  /** Estimated token count */
  tokenCount: number;

  /** Whether history has been compacted */
  compacted: boolean;

  /** Original message count before compaction (if compacted) */
  originalMessageCount?: number;

  /** Timestamp of last compaction */
  lastCompactedAt?: Date;
}

/**
 * Result of a compaction operation
 */
export interface CompactionResult {
  /** Compacted messages */
  messages: CoreMessage[];

  /** Original message count before compaction */
  originalCount: number;

  /** New message count after compaction */
  newCount: number;

  /** Estimated tokens saved */
  tokensSaved: number;

  /** Strategy used for compaction */
  strategy: string;

  /** Timestamp of compaction */
  timestamp: Date;
}

/**
 * Custom compactor function type
 */
export type CompactorFunction = (
  messages: CoreMessage[],
  config: ContextConfig
) => Promise<CoreMessage[]>;

/**
 * Token counter function type
 */
export type TokenCounterFunction = (text: string) => number;

/**
 * Context state snapshot for debugging/inspection
 */
export interface ContextSnapshot {
  /** Current messages */
  messages: CoreMessage[];

  /** Token count */
  tokenCount: number;

  /** Max tokens allowed */
  maxTokens: number;

  /** Usage percentage (0-1) */
  usagePercentage: number;

  /** Whether compaction is needed */
  needsCompaction: boolean;

  /** Compaction history */
  compactionHistory: CompactionResult[];
}
