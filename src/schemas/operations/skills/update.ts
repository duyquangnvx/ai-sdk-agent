/**
 * Update Skill Operation
 * Shared schema for RPC method and LLM tool
 */
import { z } from "zod";
import { SkillDictSchema } from "../../entities/index.js";

export const updateSkillOperation = {
	name: "update_skill",
	rpcMethod: "game.updateSkill",
	description: "Update an existing skill's properties, trigger configuration, or script code.",

	input: z.object({
		blockId: z.number().describe("The ID of the block containing the skill"),
		skillId: z.string().uuid().describe("The unique ID of the skill to update"),
		updates: z.object({
			skill_name: z.string().optional().describe("New display name"),
			trigger_type: z
				.enum([
					"on_start",
					"on_collide",
					"repeat_duration",
					"keyboard",
					"always",
					"slingshot",
					"ui_button",
					"ui_joystick",
				])
				.optional()
				.describe("New trigger type"),
			trigger_config: z
				.record(z.string(), z.unknown())
				.optional()
				.describe("New trigger configuration"),
			command_script: z.string().optional().describe("New DSL script code"),
			enabled: z.boolean().optional().describe("Enable or disable the skill"),
			description: z.string().optional().describe("New description"),
		}),
	}),

	output: z.object({
		skill: SkillDictSchema,
	}),
} as const;

export type UpdateSkillInput = z.infer<typeof updateSkillOperation.input>;
export type UpdateSkillOutput = z.infer<typeof updateSkillOperation.output>;
