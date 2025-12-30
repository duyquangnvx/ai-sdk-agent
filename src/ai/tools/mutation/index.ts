/**
 * Export all mutation tool definitions
 */
import { createToolkit } from "@voltagent/core";
import { createBlockTool } from "./create-block.js";
import { updateBlockTool } from "./update-block.js";
import { deleteBlockTool } from "./delete-block.js";
import { createSkillTool } from "./create-skill.js";
import { updateSkillTool } from "./update-skill.js";
import { deleteSkillTool } from "./delete-skill.js";
import { submitPlanTool } from "./submit-plan.js";

export const mutationTools = [
	createBlockTool,
	updateBlockTool,
	deleteBlockTool,
	createSkillTool,
	updateSkillTool,
	deleteSkillTool,
	submitPlanTool,
];

/**
 * Mutation Toolkit - Write tools for modifying game data
 * Used by GameAssistant
 */
export const mutationToolkit = createToolkit({
	name: "mutation_toolkit",
	description: "Tools for creating, updating, and deleting blocks and skills",
	instructions: `Use these tools to modify the game.

Planning:
- Use submit_plan for complex operations (4+ blocks/skills) to get user approval first
- Wait for approval before executing the plan

Block operations:
- Use create_block to add new blocks (use get_block_types first to see available types)
- Use update_block to modify block properties (position, rotation, scale, name, tag)
- Use delete_block to remove a block

Skill operations:
- Use create_skill to add behavior to a block
- Use update_skill to modify skill script, trigger, or settings
- Use delete_skill to remove a skill from a block

Always query the block first if you need to see current values before updating.`,
	addInstructions: true,
	tools: mutationTools,
});
