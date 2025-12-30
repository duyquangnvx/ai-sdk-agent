/**
 * List Blocks Operation
 * Shared schema for RPC method and LLM tool
 */
import { z } from "zod";
import { BlockSummarySchema } from "../../entities/index.js";

export const listBlocksOperation = {
	name: "list_blocks",
	rpcMethod: "game.listBlocks",
	description: "List all blocks in the game. Can filter by tag, type, or whether they have skills.",

	input: z.object({
		filter: z
			.object({
				tag: z.string().optional().describe("Filter by block tag"),
				type: z.number().optional().describe("Filter by block type ID"),
				hasSkills: z.boolean().optional().describe("Filter blocks that have skills"),
			})
			.optional()
			.describe("Optional filters"),
	}),

	output: z.object({
		blocks: z.array(BlockSummarySchema),
	}),
} as const;

export type ListBlocksInput = z.infer<typeof listBlocksOperation.input>;
export type ListBlocksOutput = z.infer<typeof listBlocksOperation.output>;
