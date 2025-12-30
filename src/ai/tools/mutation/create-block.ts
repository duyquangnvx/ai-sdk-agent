/**
 * create_block tool
 * Create a new block in the game
 */
import { createTool } from "@voltagent/core";
import {
	createBlockOperation,
	createToolOutputSchema,
} from "../../../schemas/index.js";
import { tryGetToolContext, noContextError } from "../executor.js";

export const createBlockTool = createTool({
	name: "create_block",
	description: createBlockOperation.description,
	parameters: createBlockOperation.input,
	// outputSchema: createToolOutputSchema(createBlockOperation.output),
	execute: async (params) => {
		console.log("[createBlockTool] Executing tool with params:", params);
		const ctx = tryGetToolContext();
		if (!ctx) {
			return noContextError();
		}

		console.log("[createBlockTool] Context:", ctx);

		const { rpcCaller, contextManager, sessionId } = ctx;
		const result = await rpcCaller.createBlock(params);

		console.log("[createBlockTool] Result:", result);

		if (result.success) {
			// Add new block to working blocks
			contextManager.upsertWorkingBlock(sessionId, result.data.block);
		}

		console.log("[createBlockTool] Returning result:", result);

		return result;
	},
});
