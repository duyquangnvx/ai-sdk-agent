/**
 * delete_block tool
 * Delete a block from the game
 */
import { createTool } from "@voltagent/core";
import {
	deleteBlockOperation,
	createToolOutputSchema,
} from "../../../schemas/index.js";
import { tryGetToolContext, noContextError } from "../executor.js";

export const deleteBlockTool = createTool({
	name: "delete_block",
	description: deleteBlockOperation.description,
	parameters: deleteBlockOperation.input,
	// outputSchema: createToolOutputSchema(deleteBlockOperation.output),
	execute: async ({ blockId }) => {
		const ctx = tryGetToolContext();
		if (!ctx) {
			return noContextError();
		}

		const { rpcCaller, contextManager, sessionId } = ctx;
		const result = await rpcCaller.deleteBlock(blockId);

		if (result.success) {
			// Remove block from context
			contextManager.removeWorkingBlock(sessionId, blockId);
		}

		return result;
	},
});
