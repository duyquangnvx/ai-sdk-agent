/**
 * Tool Executor Context
 * Provides execution context for AI tools to call game client via RPC
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { GameRpcCaller, ToolResult } from "../../rpc/index.js";
import type { ContextManager } from "../../context/index.js";

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
	/** Current session ID */
	sessionId: string;
	/** RPC caller for this session's connection */
	rpcCaller: GameRpcCaller;
	/** Context manager for caching */
	contextManager: ContextManager;
}

/**
 * AsyncLocalStorage for tool execution context
 * This allows tools to access context without passing it through parameters
 */
const executionContextStorage = new AsyncLocalStorage<ToolExecutionContext>();

/**
 * Run a function with tool execution context
 */
export function runWithToolContext<T>(
	context: ToolExecutionContext,
	fn: () => T,
): T {
	return executionContextStorage.run(context, fn);
}

/**
 * Get current tool execution context
 * Throws if called outside of runWithToolContext
 */
export function getToolContext(): ToolExecutionContext {
	const ctx = executionContextStorage.getStore();
	if (!ctx) {
		throw new Error("Tool execution context not available");
	}
	return ctx;
}

/**
 * Try to get tool execution context
 * Returns null if not available
 */
export function tryGetToolContext(): ToolExecutionContext | null {
	return executionContextStorage.getStore() ?? null;
}

/**
 * Create a "no context" error result
 * Used when tool is called without active session
 */
export function noContextError(): ToolResult<never> {
	return {
		success: false,
		error: {
			code: "CONNECTION_CLOSED",
			message: "No active game session. Please connect to the game first.",
			retryable: false,
		},
	};
}
