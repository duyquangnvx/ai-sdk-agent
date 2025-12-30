/**
 * get_block_types tool
 * Get available block types for creating blocks
 */
import { createTool } from "@voltagent/core";
import {
	getBlockTypesOperation,
	createToolOutputSchema,
} from "../../../schemas/index.js";
import { tryGetToolContext, noContextError } from "../executor.js";

export const getBlockTypesTool = createTool({
	name: "get_block_types",
	description: getBlockTypesOperation.description,
	parameters: getBlockTypesOperation.input,
	// outputSchema: createToolOutputSchema(getBlockTypesOperation.output),
	execute: async () => {
		const ctx = tryGetToolContext();
		if (!ctx) {
			return noContextError();
		}

		const { rpcCaller, contextManager, sessionId } = ctx;
		const result = await rpcCaller.getBlockTypes();

		if (result.success) {
			// Update context with block types
			contextManager.updateBlockTypes(sessionId, result.data.blockTypes);
		}

		return result;
	},
});
