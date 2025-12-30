/**
 * Delete Skill Operation
 * Shared schema for RPC method and LLM tool
 */
import { z } from "zod";

export const deleteSkillOperation = {
	name: "delete_skill",
	rpcMethod: "game.deleteSkill",
	description: "Delete a skill from a block.",

	input: z.object({
		blockId: z.number().describe("The ID of the block containing the skill"),
		skillId: z.string().uuid().describe("The unique ID of the skill to delete"),
	}),

	output: z.object({
		success: z.boolean(),
	}),
} as const;

export type DeleteSkillInput = z.infer<typeof deleteSkillOperation.input>;
export type DeleteSkillOutput = z.infer<typeof deleteSkillOperation.output>;
