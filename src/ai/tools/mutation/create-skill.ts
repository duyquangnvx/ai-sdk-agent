/**
 * create_skill tool
 * Create a new skill for a block
 */
import { createTool } from "@voltagent/core";
import {
	createSkillOperation,
	createToolOutputSchema,
} from "../../../schemas/index.js";
import { tryGetToolContext, noContextError } from "../executor.js";

export const createSkillTool = createTool({
	name: "create_skill",
	description: createSkillOperation.description,
	parameters: createSkillOperation.input,
	// outputSchema: createToolOutputSchema(createSkillOperation.output),
	execute: async ({ blockId, skill }) => {
		const ctx = tryGetToolContext();
		if (!ctx) {
			return noContextError();
		}

		const { rpcCaller, contextManager, sessionId } = ctx;
		const result = await rpcCaller.createSkill(blockId, skill);

		if (result.success) {
			// Add skill to block in context
			contextManager.addSkillToBlock(sessionId, blockId, result.data.skill);
		}

		return result;
	},
});
