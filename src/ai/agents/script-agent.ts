/**
 * Script Agent (Sub-agent)
 * Specialized agent for writing Text-Script DSL code
 * Based on AGENTS.md
 *
 * This is a focused version of main agent with:
 * - Only read-only query tools (no mutations)
 * - Additional script-specific tool for validation
 */
import { Agent, createTool } from "@voltagent/core";
import { z } from "zod";
import { getLLMModel } from "../../config/llm.js";
import { SCRIPT_AGENT_PROMPT } from "../prompts/index.js";
import { queryToolkit } from "../tools/query/index.js";

// Script-specific tool (not in main agent)
const validateScriptTool = createTool({
	name: "validate_script",
	description: "Validate DSL script syntax before returning",
	parameters: z.object({
		script: z.string().describe("Script to validate"),
	}),
});

/**
 * Create ScriptAgent instance
 * Reuses query tools from main agent, adds script-specific validation
 */
export const createScriptAgent = () => {
	return new Agent({
		name: "ScriptAgent",
		instructions: SCRIPT_AGENT_PROMPT,
		model: getLLMModel(),
		tools: [queryToolkit, validateScriptTool],
	});
};

// Export script-specific tool for reference
export { validateScriptTool };
