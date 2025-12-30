import { z } from "zod";

/**
 * RPC Error structure
 */
export const RpcErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
});

/**
 * RPC Request message
 */
export const RpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.string(),
  method: z.string(),
  params: z.unknown().optional(),
});

/**
 * RPC Response message
 */
export const RpcResponseSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.string(),
  result: z.unknown().optional(),
  error: RpcErrorSchema.optional(),
});

/**
 * RPC Notification message (no id = no response expected)
 */
export const RpcNotificationSchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.string(),
  params: z.unknown().optional(),
});

/**
 * Union of all RPC message types
 */
export const RpcMessageSchema = z.union([
  RpcRequestSchema,
  RpcResponseSchema,
  RpcNotificationSchema,
]);

export type RpcRequest = z.infer<typeof RpcRequestSchema>;
export type RpcResponse = z.infer<typeof RpcResponseSchema>;
export type RpcNotification = z.infer<typeof RpcNotificationSchema>;
export type RpcMessage = z.infer<typeof RpcMessageSchema>;

/**
 * Type guard for request messages
 */
export function isRequest(msg: RpcMessage): msg is RpcRequest {
  return "id" in msg && "method" in msg;
}

/**
 * Type guard for response messages
 */
export function isResponse(msg: RpcMessage): msg is RpcResponse {
  return "id" in msg && !("method" in msg);
}

/**
 * Type guard for notification messages
 */
export function isNotification(msg: RpcMessage): msg is RpcNotification {
  return !("id" in msg) && "method" in msg;
}

/**
 * Create a request message
 */
export function createRequest(
  id: string,
  method: string,
  params?: unknown,
): RpcRequest {
  return { jsonrpc: "2.0", id, method, params };
}

/**
 * Create a response message
 */
export function createResponse(id: string, result: unknown): RpcResponse {
  return { jsonrpc: "2.0", id, result };
}

/**
 * Create an error response message
 */
export function createErrorResponse(
  id: string,
  code: number,
  message: string,
  data?: unknown,
): RpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

/**
 * Create a notification message
 */
export function createNotification(
  method: string,
  params?: unknown,
): RpcNotification {
  return { jsonrpc: "2.0", method, params };
}

/**
 * Generate unique message ID
 */
export function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
