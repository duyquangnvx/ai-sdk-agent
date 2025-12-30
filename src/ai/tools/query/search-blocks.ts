/**
 * search_blocks tool
 * Search for blocks by name or properties
 */
import { createTool } from "@voltagent/core";
import {
	searchBlocksOperation,
	createToolOutputSchema,
} from "../../../schemas/index.js";
import { tryGetToolContext, noContextError } from "../executor.js";

export const searchBlocksTool = createTool({
	name: "search_blocks",
	description: searchBlocksOperation.description,
	parameters: searchBlocksOperation.input,
	// outputSchema: createToolOutputSchema(searchBlocksOperation.output),
	execute: async ({ query }) => {
		const ctx = tryGetToolContext();
		if (!ctx) {
			return noContextError();
		}

		const { rpcCaller } = ctx;
		const result = await rpcCaller.searchBlocks(query);

		// Search results are transient, not stored in context
		// Use get_block to load specific blocks

		return result;
	},
});
