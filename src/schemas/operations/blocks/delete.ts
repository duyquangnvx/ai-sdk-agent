/**
 * Delete Block Operation
 * Shared schema for RPC method (no LLM tool for this)
 */
import { z } from "zod";

export const deleteBlockOperation = {
	name: "delete_block",
	rpcMethod: "game.deleteBlock",
	description: "Delete a block from the game.",

	input: z.object({
		blockId: z.number().describe("The ID of the block to delete"),
	}),

	output: z.object({
		success: z.boolean(),
	}),
} as const;

export type DeleteBlockInput = z.infer<typeof deleteBlockOperation.input>;
export type DeleteBlockOutput = z.infer<typeof deleteBlockOperation.output>;
