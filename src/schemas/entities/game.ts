/**
 * Game-related schemas
 * Based on DATA_MODELS.md
 */
import { z } from "zod";
import { BlockDataSchema } from "./block.js";
import { Vector3Schema } from "./common.js";

// Constraint types
export const ConstraintTypeSchema = z.enum(["LOCK", "HINGE", "SPRING"]);
export type ConstraintType = z.infer<typeof ConstraintTypeSchema>;

// Constraint data
export const ConstraintSchema = z.object({
	type: z.number().describe("Joint type: 0=LOCK, 1=HINGE, 2=SPRING"),
	block_a_id: z.number(),
	block_b_id: z.number(),
});
export type Constraint = z.infer<typeof ConstraintSchema>;

// Camera settings
export const CameraSettingsSchema = z.object({
	type: z.number().describe("1=Area, 2=Object"),
	position: Vector3Schema,
	look_at: Vector3Schema,
	object_id: z.number().describe("Block ID to follow"),
	view_type: z.number().describe("1=TOP, 2-5=ISOMETRIC, 6=SIDE, 7-10=TOPSIDE"),
	distance: z.number(),
});
export type CameraSettings = z.infer<typeof CameraSettingsSchema>;

// Full game data
export const GameDataSchema = z.object({
	name: z.string(),
	created_at: z.number().describe("Timestamp in ms"),
	blocks: z.array(BlockDataSchema).default([]),
	constraints: z.array(ConstraintSchema).default([]),
	ui_layer: z.array(z.record(z.string(), z.unknown())).default([]),
	camera: CameraSettingsSchema.optional(),
});
export type GameData = z.infer<typeof GameDataSchema>;

// Game settings (subset for tool)
export const GameSettingsSchema = z.object({
	name: z.string(),
	created_at: z.number(),
	blockCount: z.number(),
	camera: CameraSettingsSchema.optional(),
});
export type GameSettings = z.infer<typeof GameSettingsSchema>;
