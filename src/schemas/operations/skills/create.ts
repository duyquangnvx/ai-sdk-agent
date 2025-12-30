/**
 * Create Skill Operation
 * Shared schema for RPC method and LLM tool
 */
import { z } from "zod";
import { SkillDictSchema } from "../../entities/index.js";

export const createSkillOperation = {
	name: "create_skill",
	rpcMethod: "game.createSkill",
	description: "Create a new skill for a block. A skill defines behavior triggered by events like collisions, keyboard input, or timers.",

	input: z.object({
		blockId: z.number().describe("The ID of the block to add the skill to"),
		skill: z.object({
			skill_name: z.string().describe("Display name for the skill"),
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
				.describe("Type of trigger that activates this skill"),
			trigger_config: z
				.record(z.string(), z.unknown())
				.optional()
				.describe("Configuration for the trigger (depends on trigger_type)"),
			command_script: z.string().optional().describe("DSL script code to execute"),
			enabled: z.boolean().optional().describe("Whether the skill is enabled (default: true)"),
			description: z.string().optional().describe("Description of what the skill does"),
		}),
	}),

	output: z.object({
		skill: SkillDictSchema,
	}),
} as const;

export type CreateSkillInput = z.infer<typeof createSkillOperation.input>;
export type CreateSkillOutput = z.infer<typeof createSkillOperation.output>;
