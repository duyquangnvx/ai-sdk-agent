import type { ModelMessage, LanguageModel } from 'ai';
import { generateText } from 'ai';
import type {
  ContextConfig,
  CompactionResult,
  ContextSnapshot,
  ConversationHistory,
} from '../types/context.types.js';
import { ConversationHistoryManager } from './conversation-history.js';

/**
 * Default context configuration
 */
const DEFAULT_CONFIG: Required<Omit<ContextConfig, 'customCompactor' | 'summaryModel'>> = {
  maxTokens: 100000,
  compactThreshold: 0.8,
  compactStrategy: 'summarize',
  preserveSystem: true,
};

/**
 * Context manager handles conversation history and auto-compaction
 * Inspired by Claude Code's context management approach
 */
export class ContextManager {
  private config: ContextConfig;
  private history: ConversationHistoryManager;
  private compactionHistory: CompactionResult[] = [];
  private summaryModel?: LanguageModel;

  constructor(config?: ContextConfig, summaryModel?: LanguageModel) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.history = new ConversationHistoryManager();
    this.summaryModel = summaryModel;
  }

  /**
   * Get current configuration
   */
  getConfig(): ContextConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContextConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Add a user message
   */
  addUserMessage(content: string): void {
    this.history.addUserMessage(content);
  }

  /**
   * Add an assistant message
   */
  addAssistantMessage(content: string): void {
    this.history.addAssistantMessage(content);
  }

  /**
   * Add a system message
   */
  addSystemMessage(content: string): void {
    this.history.addSystemMessage(content);
  }

  /**
   * Add any message
   */
  addMessage(message: ModelMessage): void {
    this.history.addMessage(message);
  }

  /**
   * Get conversation history
   */
  getHistory(): ConversationHistory {
    return this.history.getSnapshot();
  }

  /**
   * Get all messages
   */
  getMessages(): ModelMessage[] {
    return this.history.export();
  }

  /**
   * Get token count
   */
  getTokenCount(): number {
    return this.history.tokenCount;
  }

  /**
   * Check if context is near limit
   */
  isNearLimit(): boolean {
    const threshold = (this.config.maxTokens ?? DEFAULT_CONFIG.maxTokens) *
                      (this.config.compactThreshold ?? DEFAULT_CONFIG.compactThreshold);
    return this.history.tokenCount >= threshold;
  }

  /**
   * Check context size and compact if needed
   */
  async checkAndCompact(): Promise<CompactionResult | null> {
    if (this.isNearLimit()) {
      return this.compact();
    }
    return null;
  }

  /**
   * Manually trigger compaction
   */
  async compact(): Promise<CompactionResult> {
    const originalMessages = this.history.export();
    const originalCount = originalMessages.length;
    const originalTokens = this.history.tokenCount;

    let compactedMessages: ModelMessage[];

    // Use custom compactor if provided
    if (this.config.customCompactor) {
      compactedMessages = await this.config.customCompactor(originalMessages, this.config);
    } else {
      // Use built-in strategy
      compactedMessages = await this.applyCompactionStrategy(originalMessages);
    }

    // Update history with compacted messages
    this.history.replaceMessages(compactedMessages, true);

    const result: CompactionResult = {
      messages: compactedMessages,
      originalCount,
      newCount: compactedMessages.length,
      tokensSaved: originalTokens - this.history.tokenCount,
      strategy: this.config.compactStrategy ?? DEFAULT_CONFIG.compactStrategy,
      timestamp: new Date(),
    };

    this.compactionHistory.push(result);
    return result;
  }

  /**
   * Apply built-in compaction strategy
   */
  private async applyCompactionStrategy(messages: ModelMessage[]): Promise<ModelMessage[]> {
    const strategy = this.config.compactStrategy ?? DEFAULT_CONFIG.compactStrategy;
    const preserveSystem = this.config.preserveSystem ?? DEFAULT_CONFIG.preserveSystem;

    // Separate system and non-system messages
    const systemMessages = preserveSystem ? messages.filter((m) => m.role === 'system') : [];
    const nonSystemMessages = messages.filter((m) => m.role !== 'system' || !preserveSystem);

    let compactedNonSystem: ModelMessage[];

    switch (strategy) {
      case 'summarize':
        compactedNonSystem = await this.summarizeMessages(nonSystemMessages);
        break;
      case 'truncate':
        compactedNonSystem = this.truncateMessages(nonSystemMessages);
        break;
      case 'sliding-window':
        compactedNonSystem = this.slidingWindowMessages(nonSystemMessages);
        break;
      default:
        compactedNonSystem = nonSystemMessages;
    }

    // Combine system messages with compacted messages
    return [...systemMessages, ...compactedNonSystem];
  }

  /**
   * Summarize messages using LLM
   */
  private async summarizeMessages(messages: ModelMessage[]): Promise<ModelMessage[]> {
    if (messages.length <= 2) {
      return messages; // Not enough to summarize
    }

    // If no summary model, fall back to sliding window
    if (!this.summaryModel) {
      console.warn('No summary model provided, falling back to sliding-window strategy');
      return this.slidingWindowMessages(messages);
    }

    // Keep the most recent messages, summarize the rest
    const keepRecent = Math.min(4, Math.floor(messages.length / 2));
    const toSummarize = messages.slice(0, -keepRecent);
    const recentMessages = messages.slice(-keepRecent);

    try {
      const conversationText = toSummarize
        .map((m) => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
        .join('\n');

      const { text: summary } = await generateText({
        model: this.summaryModel,
        messages: [
          {
            role: 'user',
            content: `Summarize the following conversation concisely, preserving key information, decisions, and context needed for continuation:\n\n${conversationText}`,
          },
        ],
      });

      // Return summary as system message + recent messages
      return [
        {
          role: 'system' as const,
          content: `[Previous conversation summary]\n${summary}`,
        },
        ...recentMessages,
      ];
    } catch (error) {
      console.error('Failed to summarize messages, falling back to sliding-window:', error);
      return this.slidingWindowMessages(messages);
    }
  }

  /**
   * Truncate older messages
   */
  private truncateMessages(messages: ModelMessage[]): ModelMessage[] {
    // Keep roughly half the messages (most recent)
    const keepCount = Math.max(4, Math.floor(messages.length / 2));
    return messages.slice(-keepCount);
  }

  /**
   * Sliding window - keep most recent N messages
   */
  private slidingWindowMessages(messages: ModelMessage[]): ModelMessage[] {
    // Calculate how many messages to keep based on target tokens
    const targetTokens = (this.config.maxTokens ?? DEFAULT_CONFIG.maxTokens) * 0.5;
    let tokenCount = 0;
    const keptMessages: ModelMessage[] = [];

    // Work backwards from most recent
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]!;
      const msgTokens = this.estimateMessageTokens(msg);

      if (tokenCount + msgTokens > targetTokens && keptMessages.length > 0) {
        break;
      }

      keptMessages.unshift(msg);
      tokenCount += msgTokens;
    }

    return keptMessages;
  }

  /**
   * Estimate tokens for a message
   */
  private estimateMessageTokens(message: ModelMessage): number {
    if (typeof message.content === 'string') {
      return Math.ceil(message.content.length / 4);
    }
    if (Array.isArray(message.content)) {
      return message.content.reduce((total, part) => {
        if ('text' in part) {
          return total + Math.ceil(part.text.length / 4);
        }
        return total + 100;
      }, 0);
    }
    return 0;
  }

  /**
   * Clear history
   */
  clear(): void {
    this.history.clear();
    this.compactionHistory = [];
  }

  /**
   * Get context snapshot for debugging
   */
  getSnapshot(): ContextSnapshot {
    const maxTokens = this.config.maxTokens ?? DEFAULT_CONFIG.maxTokens;
    const tokenCount = this.history.tokenCount;

    return {
      messages: this.history.export(),
      tokenCount,
      maxTokens,
      usagePercentage: tokenCount / maxTokens,
      needsCompaction: this.isNearLimit(),
      compactionHistory: [...this.compactionHistory],
    };
  }

  /**
   * Set summary model for summarization strategy
   */
  setSummaryModel(model: LanguageModel): void {
    this.summaryModel = model;
  }
}
