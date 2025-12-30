/**
 * Export all query tool definitions
 */
import { createToolkit } from "@voltagent/core";
import { getBlockTool } from "./get-block.js";
import { getBlockTypesTool } from "./get-block-types.js";
import { getGameSettingsTool } from "./get-game-settings.js";
import { listBlocksTool } from "./list-blocks.js";
import { searchBlocksTool } from "./search-blocks.js";

export const queryTools = [
	listBlocksTool,
	getBlockTool,
    searchBlocksTool,
    getGameSettingsTool,
    getBlockTypesTool,
];

// ============ Toolkits ============

/**
 * Query Toolkit - Read-only tools for fetching game data
 * Used by both GameAssistant and ScriptAgent
 */
export const queryToolkit = createToolkit({
	name: "query_toolkit",
	description: "Read-only tools for fetching game data without modifications",
	instructions: `Use these tools to gather information about game state before making changes.
- Use list_blocks to get an overview of existing blocks
- Use get_block for detailed info about a specific block (includes all skills with scripts)
- Use search_blocks to find blocks by name or properties
- Use get_block_types to see available block types for creation
- Always query before updating to ensure you have current data`,
	addInstructions: true,
	tools: queryTools,
});
