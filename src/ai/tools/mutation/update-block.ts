/**
 * update_block tool
 * Update an existing block's properties
 */
import { createTool } from "@voltagent/core";
import {
	updateBlockOperation,
	createToolOutputSchema,
} from "../../../schemas/index.js";
import { tryGetToolContext, noContextError } from "../executor.js";

export const updateBlockTool = createTool({
	name: "update_block",
	description: updateBlockOperation.description,
	parameters: updateBlockOperation.input,
	// outputSchema: createToolOutputSchema(updateBlockOperation.output),
	execute: async ({ blockId, updates }) => {
		const ctx = tryGetToolContext();
		if (!ctx) {
			return noContextError();
		}

		const { rpcCaller, contextManager, sessionId } = ctx;
		const result = await rpcCaller.updateBlock(blockId, updates);

		if (result.success) {
			// Update block in working blocks
			contextManager.upsertWorkingBlock(sessionId, result.data.block);
		}

		return result;
	},
});
