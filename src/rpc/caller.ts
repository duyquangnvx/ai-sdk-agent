/**
 * RPC Caller Helper
 * Provides typed method calls to the game client with error handling
 */
import type { ConnectionManager } from "../lib/rpc/index.js";
import { RpcError, RpcErrorCode } from "../lib/rpc/index.js";
import { RPC_METHODS, GameRpcMethods } from "./methods.js";
import type { InferInput, InferOutput } from "../lib/rpc/index.js";

/**
 * Tool error codes (returned to LLM)
 */
export type ToolErrorCode =
	| "TIMEOUT"
	| "CONNECTION_CLOSED"
	| "NOT_FOUND"
	| "VALIDATION_ERROR"
	| "CLIENT_ERROR"
	| "INTERNAL_ERROR";

/**
 * Tool error (structured for LLM interpretation)
 */
export interface ToolError {
	code: ToolErrorCode;
	message: string;
	retryable: boolean;
}

/**
 * Tool result - success or error
 */
export type ToolResult<T> =
	| { success: true; data: T }
	| { success: false; error: ToolError };

/**
 * Default timeouts (ms)
 */
export const TIMEOUTS = {
	QUERY: 10000, // 10s for read operations
	MUTATION: 30000, // 30s for write operations
} as const;

/**
 * Create a tool error from RPC error
 */
function createToolError(error: unknown): ToolError {
	if (error instanceof RpcError) {
		switch (error.code) {
			case RpcErrorCode.TIMEOUT:
				return {
					code: "TIMEOUT",
					message: `Request timed out: ${error.message}`,
					retryable: true,
				};
			case RpcErrorCode.CONNECTION_CLOSED:
				return {
					code: "CONNECTION_CLOSED",
					message: "Client connection lost",
					retryable: false,
				};
			case RpcErrorCode.METHOD_NOT_FOUND:
				return {
					code: "CLIENT_ERROR",
					message: `Client does not support this method: ${error.message}`,
					retryable: false,
				};
			case RpcErrorCode.INVALID_PARAMS:
				return {
					code: "VALIDATION_ERROR",
					message: `Invalid parameters: ${error.message}`,
					retryable: false,
				};
			default:
				return {
					code: "CLIENT_ERROR",
					message: error.message,
					retryable: false,
				};
		}
	}

	if (error instanceof Error) {
		return {
			code: "INTERNAL_ERROR",
			message: error.message,
			retryable: false,
		};
	}

	return {
		code: "INTERNAL_ERROR",
		message: String(error),
		retryable: false,
	};
}

/**
 * Game RPC Caller
 * Typed wrapper around ConnectionManager for game methods
 */
export class GameRpcCaller {
	constructor(
		private connections: ConnectionManager,
		private connectionId: string,
	) {}

	/**
	 * Call a game method on the client
	 */
	private async call<TMethod extends keyof typeof GameRpcMethods>(
		method: TMethod,
		params: InferInput<(typeof GameRpcMethods)[TMethod]>,
		timeout: number,
	): Promise<ToolResult<InferOutput<(typeof GameRpcMethods)[TMethod]>>> {
		try {
			const result = await this.connections.call<
				InferOutput<(typeof GameRpcMethods)[TMethod]>
			>(this.connectionId, method, params, { timeout });

			return { success: true, data: result };
		} catch (error) {
			return { success: false, error: createToolError(error) };
		}
	}

	// =========================================================================
	// Query Methods
	// =========================================================================

	async listBlocks(
		filter?: InferInput<(typeof GameRpcMethods)["game.listBlocks"]>["filter"],
	) {
		return this.call(RPC_METHODS.LIST_BLOCKS, { filter }, TIMEOUTS.QUERY);
	}

	async getBlock(blockId: number) {
		return this.call(RPC_METHODS.GET_BLOCK, { blockId }, TIMEOUTS.QUERY);
	}

	async searchBlocks(query: string) {
		return this.call(RPC_METHODS.SEARCH_BLOCKS, { query }, TIMEOUTS.QUERY);
	}

	async getSettings() {
		return this.call(RPC_METHODS.GET_SETTINGS, {}, TIMEOUTS.QUERY);
	}

	async getBlockTypes() {
		return this.call(RPC_METHODS.GET_BLOCK_TYPES, {}, TIMEOUTS.QUERY);
	}

	// =========================================================================
	// Block Mutation Methods
	// =========================================================================

	async createBlock(
		params: InferInput<(typeof GameRpcMethods)["game.createBlock"]>,
	) {
		return this.call(RPC_METHODS.CREATE_BLOCK, params, TIMEOUTS.MUTATION);
	}

	async updateBlock(
		blockId: number,
		updates: InferInput<(typeof GameRpcMethods)["game.updateBlock"]>["updates"],
	) {
		return this.call(
			RPC_METHODS.UPDATE_BLOCK,
			{ blockId, updates },
			TIMEOUTS.MUTATION,
		);
	}

	async deleteBlock(blockId: number) {
		return this.call(RPC_METHODS.DELETE_BLOCK, { blockId }, TIMEOUTS.MUTATION);
	}

	// =========================================================================
	// Skill Mutation Methods
	// =========================================================================

	async createSkill(
		blockId: number,
		skill: InferInput<(typeof GameRpcMethods)["game.createSkill"]>["skill"],
	) {
		return this.call(
			RPC_METHODS.CREATE_SKILL,
			{ blockId, skill },
			TIMEOUTS.MUTATION,
		);
	}

	async updateSkill(
		blockId: number,
		skillId: string,
		updates: InferInput<(typeof GameRpcMethods)["game.updateSkill"]>["updates"],
	) {
		return this.call(
			RPC_METHODS.UPDATE_SKILL,
			{ blockId, skillId, updates },
			TIMEOUTS.MUTATION,
		);
	}

	async deleteSkill(blockId: number, skillId: string) {
		return this.call(
			RPC_METHODS.DELETE_SKILL,
			{ blockId, skillId },
			TIMEOUTS.MUTATION,
		);
	}

	// =========================================================================
	// Plan Methods
	// =========================================================================

	async submitPlan(
		params: InferInput<(typeof GameRpcMethods)["game.submitPlan"]>,
	) {
		// Use longer timeout for plan approval (user needs time to review)
		return this.call(RPC_METHODS.SUBMIT_PLAN, params, 300000); // 5 minutes
	}

	// =========================================================================
	// Interaction Methods
	// =========================================================================

	async askUser(
		params: InferInput<(typeof GameRpcMethods)["game.askUser"]>,
	) {
		// Use longer timeout for user interaction (user needs time to respond)
		return this.call(RPC_METHODS.ASK_USER, params, 300000); // 5 minutes
	}
}

/**
 * Create a game RPC caller for a connection
 */
export function createGameRpcCaller(
	connections: ConnectionManager,
	connectionId: string,
): GameRpcCaller {
	return new GameRpcCaller(connections, connectionId);
}
