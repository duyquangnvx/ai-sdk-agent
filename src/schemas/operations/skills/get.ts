/**
 * Get Skill Operation
 * Shared schema for RPC method and LLM tool
 */
import { z } from "zod";
import { SkillDictSchema } from "../../entities/index.js";

export const getSkillOperation = {
	name: "get_skill",
	rpcMethod: "game.getSkill",
	description:
		"Get detailed information about a specific skill by ID, including its trigger configuration and script code.",

	input: z.object({
		blockId: z.number().describe("The ID of the block that contains the skill"),
		skillId: z.string().uuid().describe("The unique ID of the skill to retrieve"),
	}),

	output: z.object({
		skill: SkillDictSchema,
	}),
} as const;

export type GetSkillInput = z.infer<typeof getSkillOperation.input>;
export type GetSkillOutput = z.infer<typeof getSkillOperation.output>;
