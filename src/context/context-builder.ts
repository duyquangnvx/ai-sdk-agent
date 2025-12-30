/**
 * Context Builder
 * Builds context string for LLM injection
 */
import type { SessionContext } from "./types.js";
import { createEmptyGameContext } from "./types.js";

/**
 * Build context string from session context
 * Returns JSON string of GameContext for generateText({ context })
 */
export function buildContext(sessionContext: SessionContext | null): string {
	if (!sessionContext) {
		return JSON.stringify(createEmptyGameContext());
	}
	return JSON.stringify(sessionContext.context);
}
