/**
 * Submit Plan Operation
 * Shared schema for RPC method and LLM tool
 */
import { z } from "zod";

// Plan step schema
export const PlanStepSchema = z.object({
	id: z.string().describe("Unique ID for this step"),
	description: z.string().describe("What will be done in this step"),
});

export const submitPlanOperation = {
	name: "submit_plan",
	rpcMethod: "game.submitPlan",
	description:
		"Submit a plan for user review before executing. The user can approve, reject, or request changes. Use this before making significant changes.",

	input: z.object({
		title: z.string().describe("Short title for the plan"),
		summary: z.string().describe("Brief summary of what will be done"),
		steps: z.array(PlanStepSchema).min(1).describe("List of steps to execute"),
	}),

	output: z.object({
		approved: z.boolean().describe("Whether the user approved the plan"),
		planId: z.string().describe("Unique ID for this plan"),
		feedback: z.string().optional().describe("User feedback or reason for rejection"),
	}),
} as const;

export type PlanStep = z.infer<typeof PlanStepSchema>;
export type SubmitPlanInput = z.infer<typeof submitPlanOperation.input>;
export type SubmitPlanOutput = z.infer<typeof submitPlanOperation.output>;
