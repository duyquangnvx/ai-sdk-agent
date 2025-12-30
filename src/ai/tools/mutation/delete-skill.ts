/**
 * delete_skill tool
 * Delete a skill from a block
 */
import { createTool } from "@voltagent/core";
import {
	deleteSkillOperation,
	createToolOutputSchema,
} from "../../../schemas/index.js";
import { tryGetToolContext, noContextError } from "../executor.js";

export const deleteSkillTool = createTool({
	name: "delete_skill",
	description: deleteSkillOperation.description,
	parameters: deleteSkillOperation.input,
	// outputSchema: createToolOutputSchema(deleteSkillOperation.output),
	execute: async ({ blockId, skillId }) => {
		const ctx = tryGetToolContext();
		if (!ctx) {
			return noContextError();
		}

		const { rpcCaller, contextManager, sessionId } = ctx;
		const result = await rpcCaller.deleteSkill(blockId, skillId);

		if (result.success) {
			// Remove skill from block in context
			contextManager.removeSkillFromBlock(sessionId, blockId, skillId);
		}

		return result;
	},
});
