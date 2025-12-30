/**
 * Tool Result Schema
 * Unified output schema for all tools, matching RPC caller ToolResult type
 */
import { z } from "zod";

/**
 * Tool error codes (matches rpc/caller.ts ToolErrorCode)
 */
export const ToolErrorCodeSchema = z.enum([
	"TIMEOUT",
	"CONNECTION_CLOSED",
	"NOT_FOUND",
	"VALIDATION_ERROR",
	"CLIENT_ERROR",
	"INTERNAL_ERROR",
]);

/**
 * Tool error schema (matches rpc/caller.ts ToolError)
 */
export const ToolErrorSchema = z.object({
	code: ToolErrorCodeSchema,
	message: z.string(),
	retryable: z.boolean(),
});

export type ToolError = z.infer<typeof ToolErrorSchema>;

/**
 * Create a tool output schema wrapping data with success/error discriminated union
 *
 * Usage:
 * ```typescript
 * const outputSchema = createToolOutputSchema(listBlocksOperation.output);
 * // Returns: { success: true, data: T } | { success: false, error: ToolError }
 * ```
 */
export function createToolOutputSchema<T extends z.ZodTypeAny>(dataSchema: T) {
	return z.discriminatedUnion("success", [
		z.object({
			success: z.literal(true),
			data: dataSchema,
		}),
		z.object({
			success: z.literal(false),
			error: ToolErrorSchema,
		}),
	]);
}

/**
 * Infer the output type from a tool output schema
 */
export type ToolOutput<T extends z.ZodTypeAny> = z.infer<
	ReturnType<typeof createToolOutputSchema<T>>
>;
