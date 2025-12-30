/**
 * Context management types
 * Simplified game state cache for each session
 */
import type { BlockData, GameSettings, BlockType } from "../schemas/index.js";

/**
 * Game context for LLM injection
 * This is stored directly and passed to generateText({ context })
 *
 * Tool returns use ToolResult wrapper (success/error).
 * Full data lives here, LLM sees this context + tool results.
 */
export interface GameContext {
	/** All block IDs in the game */
	blockIds: number[];

	/** Full block data for blocks the LLM is working with */
	workingBlocks: BlockData[];

	/** Game settings (name, blockCount, etc.) */
	settings: GameSettings | null;

	/** Available block types for creation */
	blockTypes: BlockType[] | null;
}

/**
 * Session context - wraps game context for a session
 */
export interface SessionContext {
	sessionId: string;
	context: GameContext;
}

/**
 * Create an empty GameContext
 */
export function createEmptyGameContext(): GameContext {
	return {
		blockIds: [],
		workingBlocks: [],
		settings: null,
		blockTypes: null,
	};
}
