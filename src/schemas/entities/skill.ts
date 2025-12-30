/**
 * Skill-related schemas
 * Based on DATA_MODELS.md
 */
import { z } from "zod";

// Trigger types
export const TriggerTypeSchema = z.enum([
	"on_start",
	"on_collide",
	"repeat_duration",
	"keyboard",
	"always",
	"slingshot",
	"ui_button",
	"ui_joystick",
]);
export type TriggerType = z.infer<typeof TriggerTypeSchema>;

// Trigger configs per type
export const OnCollideTriggerConfigSchema = z.object({
	target_tag: z.string().optional().describe("Filter by block tag (empty = all)"),
});

export const RepeatDurationTriggerConfigSchema = z.object({
	duration: z.number().min(0.01).max(3600).describe("Interval in seconds"),
});

export const KeyboardTriggerConfigSchema = z.object({
	key: z.string().describe("Key: A-Z, 0-9, F1-F12, SPACE, ENTER, etc."),
	mode: z.enum(["press", "hold", "release"]),
});

export const UIButtonTriggerConfigSchema = z.object({
	ui_type: z.enum(["up", "down", "left", "right"]),
	mode: z.enum(["press", "hold", "release"]),
});

export const UIJoystickTriggerConfigSchema = z.object({
	min_magnitude: z.number().min(0).max(1).default(0.1).describe("Minimum joystick magnitude"),
});

// Union of all trigger configs
export const TriggerConfigSchema = z.union([
	OnCollideTriggerConfigSchema,
	RepeatDurationTriggerConfigSchema,
	KeyboardTriggerConfigSchema,
	UIButtonTriggerConfigSchema,
	UIJoystickTriggerConfigSchema,
	z.object({}), // Empty config for on_start, always, slingshot
]);
export type TriggerConfig = z.infer<typeof TriggerConfigSchema>;

// Skill data (full)
export const SkillDictSchema = z.object({
	skill_id: z.string().uuid().describe("Unique skill ID"),
	skill_name: z.string().describe("Display name"),
	enabled: z.boolean().default(true),
	description: z.string().default(""),
	trigger_type: z.string().describe("Trigger type"),
	trigger_config: z.record(z.string(), z.unknown()).default({}),
	command_script: z.string().default("").describe("DSL script code"),
});
export type SkillDict = z.infer<typeof SkillDictSchema>;

// Simplified skill for listing
export const SkillSummarySchema = z.object({
	skill_id: z.string(),
	skill_name: z.string(),
	enabled: z.boolean(),
	trigger_type: z.string(),
	has_script: z.boolean(),
});
export type SkillSummary = z.infer<typeof SkillSummarySchema>;
