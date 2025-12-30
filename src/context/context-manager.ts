/**
 * Context Manager
 * Manages game context for each session
 */
import type { BlockData, GameSettings, BlockType } from "../schemas/index.js";
import type { SessionContext, GameContext } from "./types.js";
import { createEmptyGameContext } from "./types.js";

const MAX_WORKING_BLOCKS = 10;

export class ContextManager {
	private contexts: Map<string, SessionContext> = new Map();

	/**
	 * Create a new context for a session
	 */
	createContext(sessionId: string): SessionContext {
		const sessionContext: SessionContext = {
			sessionId,
			context: createEmptyGameContext(),
		};

		this.contexts.set(sessionId, sessionContext);
		return sessionContext;
	}

	/**
	 * Get session context
	 */
	getSessionContext(sessionId: string): SessionContext | null {
		return this.contexts.get(sessionId) ?? null;
	}

	/**
	 * Get or create session context
	 */
	getOrCreateSessionContext(sessionId: string): SessionContext {
		const existing = this.contexts.get(sessionId);
		if (existing) return existing;
		return this.createContext(sessionId);
	}

	/**
	 * Get game context for a session (for LLM injection)
	 */
	getGameContext(sessionId: string): GameContext | null {
		return this.contexts.get(sessionId)?.context ?? null;
	}

	/**
	 * Delete context for a session
	 */
	deleteContext(sessionId: string): boolean {
		return this.contexts.delete(sessionId);
	}

	// =========================================================================
	// Block IDs
	// =========================================================================

	/**
	 * Update block IDs list
	 */
	updateBlockIds(sessionId: string, blockIds: number[]): void {
		const session = this.getOrCreateSessionContext(sessionId);
		session.context.blockIds = blockIds;
	}

	/**
	 * Add a block ID to the list
	 */
	addBlockId(sessionId: string, blockId: number): void {
		const session = this.getOrCreateSessionContext(sessionId);
		if (!session.context.blockIds.includes(blockId)) {
			session.context.blockIds.push(blockId);
		}
	}

	/**
	 * Remove a block ID from the list
	 */
	removeBlockId(sessionId: string, blockId: number): void {
		const session = this.getOrCreateSessionContext(sessionId);
		session.context.blockIds = session.context.blockIds.filter(
			(id) => id !== blockId,
		);
	}

	// =========================================================================
	// Working Blocks
	// =========================================================================

	/**
	 * Add or update a block in working blocks
	 * Moves block to front (most recent), trims to max size
	 */
	upsertWorkingBlock(sessionId: string, block: BlockData): void {
		const session = this.getOrCreateSessionContext(sessionId);
		const ctx = session.context;

		// Remove if exists
		ctx.workingBlocks = ctx.workingBlocks.filter((b) => b.id !== block.id);

		// Add to front
		ctx.workingBlocks.unshift(block);

		// Trim to max size
		if (ctx.workingBlocks.length > MAX_WORKING_BLOCKS) {
			ctx.workingBlocks = ctx.workingBlocks.slice(0, MAX_WORKING_BLOCKS);
		}

		// Ensure block ID is in blockIds
		this.addBlockId(sessionId, block.id);
	}

	/**
	 * Remove a block from working blocks
	 */
	removeWorkingBlock(sessionId: string, blockId: number): void {
		const session = this.contexts.get(sessionId);
		if (!session) return;

		session.context.workingBlocks = session.context.workingBlocks.filter(
			(b) => b.id !== blockId,
		);

		// Also remove from blockIds
		this.removeBlockId(sessionId, blockId);
	}

	/**
	 * Get a working block by ID
	 */
	getWorkingBlock(sessionId: string, blockId: number): BlockData | null {
		const session = this.contexts.get(sessionId);
		return session?.context.workingBlocks.find((b) => b.id === blockId) ?? null;
	}

	// =========================================================================
	// Skills (update within working blocks)
	// =========================================================================

	/**
	 * Add a skill to a working block
	 */
	addSkillToBlock(
		sessionId: string,
		blockId: number,
		skill: BlockData["skills"][0],
	): void {
		const block = this.getWorkingBlock(sessionId, blockId);
		if (!block) return;

		block.skills = [...block.skills, skill];
	}

	/**
	 * Update a skill in a working block
	 */
	updateSkillInBlock(
		sessionId: string,
		blockId: number,
		skillId: string,
		updatedSkill: BlockData["skills"][0],
	): void {
		const block = this.getWorkingBlock(sessionId, blockId);
		if (!block) return;

		const idx = block.skills.findIndex((s) => s.skill_id === skillId);
		if (idx !== -1) {
			block.skills[idx] = updatedSkill;
		}
	}

	/**
	 * Remove a skill from a working block
	 */
	removeSkillFromBlock(
		sessionId: string,
		blockId: number,
		skillId: string,
	): void {
		const block = this.getWorkingBlock(sessionId, blockId);
		if (!block) return;

		block.skills = block.skills.filter((s) => s.skill_id !== skillId);
	}

	// =========================================================================
	// Settings & Block Types
	// =========================================================================

	/**
	 * Update game settings
	 */
	updateSettings(sessionId: string, settings: GameSettings): void {
		const session = this.getOrCreateSessionContext(sessionId);
		session.context.settings = settings;
	}

	/**
	 * Update block types
	 */
	updateBlockTypes(sessionId: string, blockTypes: BlockType[]): void {
		const session = this.getOrCreateSessionContext(sessionId);
		session.context.blockTypes = blockTypes;
	}

	// =========================================================================
	// Utilities
	// =========================================================================

	/**
	 * Clear all data for a session
	 */
	clearContext(sessionId: string): void {
		const session = this.contexts.get(sessionId);
		if (!session) return;

		session.context = createEmptyGameContext();
	}
}
