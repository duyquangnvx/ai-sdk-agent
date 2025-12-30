/**
 * Update Block Operation
 * Shared schema for RPC method and LLM tool
 */
import { z } from "zod";
import { BlockDataSchema, Vector3Schema } from "../../entities/index.js";

export const updateBlockOperation = {
	name: "update_block",
	rpcMethod: "game.updateBlock",
	description: "Update an existing block's properties. Returns the updated block data.",

	input: z.object({
		blockId: z.number().describe("The ID of the block to update"),
		updates: z.object({
			name: z.string().optional().describe("New name for the block"),
			tag: z.string().optional().describe("New tag for the block"),
			position: Vector3Schema.optional().describe("New position"),
			rotation: Vector3Schema.optional().describe("New rotation"),
			scale: Vector3Schema.optional().describe("New scale"),
		}),
	}),

	output: z.object({
		block: BlockDataSchema,
	}),
} as const;

export type UpdateBlockInput = z.infer<typeof updateBlockOperation.input>;
export type UpdateBlockOutput = z.infer<typeof updateBlockOperation.output>;
