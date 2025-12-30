/**
 * Create Block Operation
 * Shared schema for RPC method and LLM tool
 */
import { z } from "zod";
import { BlockDataSchema, Vector3Schema } from "../../entities/index.js";

export const createBlockOperation = {
	name: "create_block",
	rpcMethod: "game.createBlock",
	description: "Create a new block in the game with specified properties. Returns the created block data.",

	input: z.object({
		name: z.string().describe("Name of the block"),
		tag: z.string().describe("Block tag (player, enemy, obstacle, etc.)"),
		type: z.number().describe("Block type ID (references BlockObjectConfig)"),
		position: Vector3Schema.describe("Position in 3D space"),
		rotation: Vector3Schema.optional().describe("Rotation in 3D space (optional)"),
		scale: Vector3Schema.optional().describe("Scale in 3D space (optional)"),
	}),

	output: z.object({
		block: BlockDataSchema,
	}),
} as const;

export type CreateBlockInput = z.infer<typeof createBlockOperation.input>;
export type CreateBlockOutput = z.infer<typeof createBlockOperation.output>;
