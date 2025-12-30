/**
 * Get Block Operation
 * Shared schema for RPC method and LLM tool
 */
import { z } from "zod";
import { BlockDataSchema } from "../../entities/index.js";

export const getBlockOperation = {
	name: "get_block",
	rpcMethod: "game.getBlock",
	description:
		"Get detailed information about a specific block by ID, including all its skills and properties.",

	input: z.object({
		blockId: z.number().describe("The ID of the block to retrieve"),
	}),

	output: z.object({
		block: BlockDataSchema,
	}),
} as const;

export type GetBlockInput = z.infer<typeof getBlockOperation.input>;
export type GetBlockOutput = z.infer<typeof getBlockOperation.output>;
