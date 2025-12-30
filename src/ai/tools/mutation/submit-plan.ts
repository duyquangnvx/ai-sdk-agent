/**
 * submit_plan tool
 * Submit a plan for user approval before executing
 */
import { tool } from "ai";
import {
	submitPlanOperation,
	createToolOutputSchema,
} from "../../../schemas/index.js";
import { tryGetToolContext, noContextError } from "../executor.js";

export const submitPlanTool = tool({
	description: submitPlanOperation.description,
	inputSchema: submitPlanOperation.input,
	// outputSchema: createToolOutputSchema(submitPlanOperation.output),
	execute: async (params) => {
		const ctx = tryGetToolContext();
		if (!ctx) {
			return noContextError();
		}

		const { rpcCaller } = ctx;

		// Send plan to client for user approval
		// This will block until user approves/rejects (up to 5 minutes)
		const result = await rpcCaller.submitPlan(params);

		// Plan approval doesn't modify game state, no context update needed

		return result;
	},
});
