/**
 * list_blocks tool
 * Lists all blocks with optional filters
 */
import { createTool } from "@voltagent/core";
import {
	listBlocksOperation,
	createToolOutputSchema,
} from "../../../schemas/index.js";
import { tryGetToolContext, noContextError } from "../executor.js";

export const listBlocksTool = createTool({
	name: "list_blocks",
	description: listBlocksOperation.description,
	parameters: listBlocksOperation.input,
	// outputSchema: createToolOutputSchema(listBlocksOperation.output),
	execute: async ({ filter }) => {
		const ctx = tryGetToolContext();
		if (!ctx) {
			return noContextError();
		}

		const { rpcCaller, contextManager, sessionId } = ctx;
		const result = await rpcCaller.listBlocks(filter);

		if (result.success) {
			// Update context with block IDs
			const blockIds = result.data.blocks.map((b) => b.id);
			contextManager.updateBlockIds(sessionId, blockIds);
		}

		return result;
	},
});
