/**
 * Get Block Types Operation
 * Shared schema for RPC method and LLM tool
 */
import { z } from "zod";

// Block type definition from client config
export const BlockTypeSchema = z.object({
	id: z.number().describe("Block type ID"),
	name: z.string().describe("Display name"),
	description: z.string().optional().describe("Description of this block type"),
	category: z.string().optional().describe("Category (e.g., 'basic', 'vehicle', 'character')"),
});

export const getBlockTypesOperation = {
	name: "get_block_types",
	rpcMethod: "game.getBlockTypes",
	description: "Get available block types that can be used when creating blocks. Each type has a unique ID and defines the visual appearance.",

	input: z.object({}),

	output: z.object({
		blockTypes: z.array(BlockTypeSchema),
	}),
} as const;

export type BlockType = z.infer<typeof BlockTypeSchema>;
export type GetBlockTypesInput = z.infer<typeof getBlockTypesOperation.input>;
export type GetBlockTypesOutput = z.infer<typeof getBlockTypesOperation.output>;
