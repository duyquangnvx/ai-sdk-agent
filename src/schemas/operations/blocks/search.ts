/**
 * Search Blocks Operation
 * Shared schema for RPC method and LLM tool
 */
import { z } from "zod";
import { BlockSummarySchema } from "../../entities/index.js";

export const searchBlocksOperation = {
	name: "search_blocks",
	rpcMethod: "game.searchBlocks",
	description: "Search for blocks by name or properties. Returns a list of matching blocks.",

	input: z.object({
		query: z.string().describe("The search query to match against block names and properties"),
	}),

	output: z.object({
		blocks: z.array(BlockSummarySchema),
	}),
} as const;

export type SearchBlocksInput = z.infer<typeof searchBlocksOperation.input>;
export type SearchBlocksOutput = z.infer<typeof searchBlocksOperation.output>;
