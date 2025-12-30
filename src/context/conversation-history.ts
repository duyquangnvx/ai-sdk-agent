import type { CoreMessage } from 'ai';
import type { ConversationHistory as IConversationHistory } from '../types/context.types.js';

/**
 * Simple token estimation (roughly 4 chars per token)
 * Can be replaced with a more accurate tokenizer
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for a message
 */
function estimateMessageTokens(message: CoreMessage): number {
  if (typeof message.content === 'string') {
    return estimateTokens(message.content);
  }
  if (Array.isArray(message.content)) {
    return message.content.reduce((total, part) => {
      if ('text' in part) {
        return total + estimateTokens(part.text);
      }
      return total + 100; // Rough estimate for non-text content
    }, 0);
  }
  return 0;
}

/**
 * Conversation history manager
 * Tracks messages and token usage
 */
export class ConversationHistoryManager implements IConversationHistory {
  private _messages: CoreMessage[] = [];
  private _tokenCount: number = 0;
  private _compacted: boolean = false;
  private _originalMessageCount?: number;
  private _lastCompactedAt?: Date;

  constructor(initialMessages?: CoreMessage[]) {
    if (initialMessages) {
      initialMessages.forEach((msg) => this.addMessage(msg));
    }
  }

  get messages(): CoreMessage[] {
    return [...this._messages];
  }

  get tokenCount(): number {
    return this._tokenCount;
  }

  get compacted(): boolean {
    return this._compacted;
  }

  get originalMessageCount(): number | undefined {
    return this._originalMessageCount;
  }

  get lastCompactedAt(): Date | undefined {
    return this._lastCompactedAt;
  }

  /**
   * Add a message to the history
   */
  addMessage(message: CoreMessage): void {
    this._messages.push(message);
    this._tokenCount += estimateMessageTokens(message);
  }

  /**
   * Add a user message
   */
  addUserMessage(content: string): void {
    this.addMessage({ role: 'user', content });
  }

  /**
   * Add an assistant message
   */
  addAssistantMessage(content: string): void {
    this.addMessage({ role: 'assistant', content });
  }

  /**
   * Add a system message
   */
  addSystemMessage(content: string): void {
    this.addMessage({ role: 'system', content });
  }

  /**
   * Get recent messages
   */
  getRecent(count: number): CoreMessage[] {
    return this._messages.slice(-count);
  }

  /**
   * Get all system messages
   */
  getSystemMessages(): CoreMessage[] {
    return this._messages.filter((msg) => msg.role === 'system');
  }

  /**
   * Get all non-system messages
   */
  getNonSystemMessages(): CoreMessage[] {
    return this._messages.filter((msg) => msg.role !== 'system');
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this._messages = [];
    this._tokenCount = 0;
    this._compacted = false;
    this._originalMessageCount = undefined;
  }

  /**
   * Export messages (creates a copy)
   */
  export(): CoreMessage[] {
    return [...this._messages];
  }

  /**
   * Replace all messages (used after compaction)
   */
  replaceMessages(messages: CoreMessage[], wasCompacted: boolean = false): void {
    if (wasCompacted) {
      this._originalMessageCount = this._messages.length;
      this._compacted = true;
      this._lastCompactedAt = new Date();
    }

    this._messages = [...messages];
    this._tokenCount = messages.reduce((total, msg) => total + estimateMessageTokens(msg), 0);
  }

  /**
   * Get a snapshot of the current state
   */
  getSnapshot(): IConversationHistory {
    return {
      messages: this.export(),
      tokenCount: this._tokenCount,
      compacted: this._compacted,
      originalMessageCount: this._originalMessageCount,
      lastCompactedAt: this._lastCompactedAt,
    };
  }

  /**
   * Create from snapshot
   */
  static fromSnapshot(snapshot: IConversationHistory): ConversationHistoryManager {
    const history = new ConversationHistoryManager();
    history._messages = [...snapshot.messages];
    history._tokenCount = snapshot.tokenCount;
    history._compacted = snapshot.compacted;
    history._originalMessageCount = snapshot.originalMessageCount;
    history._lastCompactedAt = snapshot.lastCompactedAt;
    return history;
  }
}
