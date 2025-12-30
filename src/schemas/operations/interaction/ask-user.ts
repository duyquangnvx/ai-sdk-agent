/**
 * Ask User Operation Schema
 * Allows LLM to ask structured questions to the user
 */
import { z } from "zod";

/**
 * Question types supported by the ask_user tool
 */
export const QuestionTypeSchema = z.enum([
	"single_choice", // Radio buttons - pick one
	"multiple_choice", // Checkboxes - pick many
	"text", // Free text input
	"number", // Number input
	"confirm", // Yes/No confirmation
]);

export type QuestionType = z.infer<typeof QuestionTypeSchema>;

/**
 * Option for choice-type questions
 */
export const QuestionOptionSchema = z.object({
	label: z.string().describe("Display text for this option"),
	value: z.string().describe("Value returned if selected"),
	description: z.string().optional().describe("Additional explanation"),
});

export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

/**
 * Single question definition
 */
export const QuestionSchema = z.object({
	id: z.string().describe("Unique ID for this question"),
	type: QuestionTypeSchema.describe("Type of question"),
	question: z.string().describe("The question text"),
	description: z.string().optional().describe("Additional context"),
	required: z.boolean().optional().default(true).describe("Required to answer"),

	// For choice types (single_choice, multiple_choice)
	options: z
		.array(QuestionOptionSchema)
		.optional()
		.describe("Options for choice questions"),

	// For text type
	placeholder: z.string().optional().describe("Placeholder text"),
	maxLength: z.number().optional().describe("Maximum text length"),

	// For number type
	min: z.number().optional().describe("Minimum value"),
	max: z.number().optional().describe("Maximum value"),
	step: z.number().optional().describe("Step increment"),
});

export type Question = z.infer<typeof QuestionSchema>;

/**
 * Answer for a single question
 */
export const AnswerSchema = z.object({
	questionId: z.string().describe("ID of the answered question"),
	value: z
		.union([
			z.string(), // For single_choice, text
			z.array(z.string()), // For multiple_choice
			z.number(), // For number
			z.boolean(), // For confirm
		])
		.describe("The user's answer"),
});

export type Answer = z.infer<typeof AnswerSchema>;

/**
 * Ask User Operation
 */
export const askUserOperation = {
	name: "ask_user",
	rpcMethod: "game.askUser",
	description:
		"Ask the user structured questions. Use this when you need specific information from the user. Supports multiple questions with different types: single choice, multiple choice, text, number, or yes/no confirmation.",

	input: z.object({
		questions: z
			.array(QuestionSchema)
			.min(1)
			.max(5)
			.describe("Questions to ask (1-5)"),
		title: z
			.string()
			.optional()
			.describe("Modal title (default: 'Questions from Assistant')"),
	}),

	output: z.object({
		answered: z
			.boolean()
			.describe("Whether user submitted answers (false if cancelled/timeout)"),
		answers: z.array(AnswerSchema).describe("Answers for each question"),
	}),
} as const;

export type AskUserInput = z.infer<typeof askUserOperation.input>;
export type AskUserOutput = z.infer<typeof askUserOperation.output>;
