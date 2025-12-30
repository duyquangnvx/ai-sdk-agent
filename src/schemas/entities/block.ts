/**
 * Block-related schemas
 * Based on DATA_MODELS.md
 */
import { z } from "zod";
import { ColorSchema, Vector3Schema } from "./common.js";
import { SkillDictSchema } from "./skill.js";

// Valid block tags
export const BlockTagSchema = z.enum([
	"player",
	"enemy",
	"car",
	"block",
	"wall",
	"obstacle",
	"collectible",
	"platform",
	"projectile",
	"decoration",
	"trigger",
	"hazard",
	"spawner",
	"checkpoint",
	"boss",
]);
export type BlockTag = z.infer<typeof BlockTagSchema>;

// Physics properties
export const PhysicsSchema = z.object({
	mass: z.number().positive().default(1),
	is_static: z.boolean().default(false),
	bounce: z.number().min(0).max(1).default(0.5),
	friction: z.number().min(0).max(1).default(0.5),
});
export type Physics = z.infer<typeof PhysicsSchema>;

// Block data (full)
export const BlockDataSchema = z.object({
	id: z.number(),
	name: z.string(),
	tag: z.string(), // BlockTag as string for flexibility
	position: Vector3Schema,
	rotation: Vector3Schema,
	scale: Vector3Schema,
	type: z.number(), // BlockObjectConfig ID reference
	is_physic_enabled: z.boolean().default(true),
	physic: PhysicsSchema,
	skills: z.array(z.lazy(() => SkillDictSchema)).default([]),
	surface_colors: z.record(z.string(), ColorSchema).default({}),
});
export type BlockData = z.infer<typeof BlockDataSchema>;

// Simplified block for listing
export const BlockSummarySchema = z.object({
	id: z.number(),
	name: z.string(),
	tag: z.string(),
	position: Vector3Schema,
	type: z.number(),
	skillCount: z.number(),
});
export type BlockSummary = z.infer<typeof BlockSummarySchema>;
