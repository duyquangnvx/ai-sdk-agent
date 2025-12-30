/**
 * update_skill tool
 * Update an existing skill's properties
 */
import { createTool } from "@voltagent/core";
import {
	updateSkillOperation,
	createToolOutputSchema,
} from "../../../schemas/index.js";
import { tryGetToolContext, noContextError } from "../executor.js";

export const updateSkillTool = createTool({
	name: "update_skill",
	description: updateSkillOperation.description,
	parameters: updateSkillOperation.input,
	// outputSchema: createToolOutputSchema(updateSkillOperation.output),
	execute: async ({ blockId, skillId, updates }) => {
		const ctx = tryGetToolContext();
		if (!ctx) {
			return noContextError();
		}

		const { rpcCaller, contextManager, sessionId } = ctx;
		const result = await rpcCaller.updateSkill(blockId, skillId, updates);

		if (result.success) {
			// Update skill in block in context
			contextManager.updateSkillInBlock(
				sessionId,
				blockId,
				skillId,
				result.data.skill,
			);
		}

		return result;
	},
});
