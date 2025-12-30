/**
 * get_block tool
 * Get detailed information about a specific block including its skills
 */
import { createTool } from "@voltagent/core";
import {
	getBlockOperation,
	createToolOutputSchema,
} from "../../../schemas/index.js";
import { tryGetToolContext, noContextError } from "../executor.js";

export const getBlockTool = createTool({
	name: "get_block",
	description: getBlockOperation.description,
	parameters: getBlockOperation.input,
	// outputSchema: createToolOutputSchema(getBlockOperation.output),
	execute: async ({ blockId }) => {
		const ctx = tryGetToolContext();
		if (!ctx) {
			return noContextError();
		}

		const { rpcCaller, contextManager, sessionId } = ctx;
		const result = await rpcCaller.getBlock(blockId);

		if (result.success) {
			// Add to working blocks
			contextManager.upsertWorkingBlock(sessionId, result.data.block);
		}

		return result;
	},
});
