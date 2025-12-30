/**
 * Game Assistant (Main Agent)
 * Primary agent for game building assistance
 * Based on AGENTS.md and ARCHITECTURE.md
 */
import { Memory, PlanAgent, createHooks } from "@voltagent/core";
import { LibSQLMemoryAdapter } from "@voltagent/libsql";
import { getLLMModel } from "../../config/llm.js";
import { MAIN_AGENT_PROMPT, PLANNING_PROMPT } from "../prompts/index.js";
import { queryToolkit } from "../tools/query/index.js";
import { mutationToolkit } from "../tools/mutation/index.js";
import { interactionToolkit } from "../tools/interaction/index.js";
import { createScriptAgent } from "./script-agent.js";

// Memory for conversation persistence
export const memory = new Memory({
	storage: new LibSQLMemoryAdapter({
		url: "file:.voltagent/game-memory.db",
	}),
});

// Script sub-agent
const scriptAgent = createScriptAgent();

// Agent hooks for observability
const hooks = createHooks({
	onStart: async ({ agent, context }) => {
		console.log(`[${agent.name}] Starting operation ${context.operationId}`);
	},

	onEnd: async ({ agent, output, error }) => {
		if (error) {
			console.error(`[${agent.name}] Error:`, error.message);
		} else {
			const tokens = output?.usage?.totalTokens ?? 0;
			console.log(`[${agent.name}] Completed | Tokens: ${tokens}`);
		}
	},

	onToolStart: async ({ agent, tool, args }) => {
		console.log(`[${agent.name}] Tool requested: ${tool.name}`, args);
	},

	onToolEnd: async ({ agent, tool, output }) => {
		console.log(`[${agent.name}] Tool completed: ${tool.name}`, output);
	},

	onHandoff: async ({ agent, sourceAgent }) => {
		console.log(`[Handoff] ${sourceAgent.name} -> ${agent.name}`);
	},
});

// Main agent - export directly
export const gameAssistant = new PlanAgent({
	name: "GameAssistant",
	systemPrompt: MAIN_AGENT_PROMPT,
	model: getLLMModel(),
	tools: [queryToolkit, mutationToolkit, interactionToolkit],
	subagents: [scriptAgent],
	memory,
	hooks,
	// planning: false,
	planning: {
		systemPrompt: PLANNING_PROMPT,
	},
});
