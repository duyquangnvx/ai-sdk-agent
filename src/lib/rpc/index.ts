// Core types
export {
  defineMethod,
  type RpcMethodDef,
  type MethodRegistry,
  type RpcCaller,
  type CallOptions,
  type RpcConnection,
  type ConnectionMetadata,
  type RpcContext,
  type RpcHandler,
  type RpcHooks,
  type RpcPluginOptions,
  type InferInput,
  type InferOutput,
} from "./types.js";

// Protocol
export {
  RpcRequestSchema,
  RpcResponseSchema,
  RpcNotificationSchema,
  RpcMessageSchema,
  RpcErrorSchema,
  isRequest,
  isResponse,
  isNotification,
  createRequest,
  createResponse,
  createErrorResponse,
  createNotification,
  generateMessageId,
  type RpcRequest,
  type RpcResponse,
  type RpcNotification,
  type RpcMessage,
} from "./protocol.js";

// Errors
export { RpcError, RpcErrorCode } from "./errors.js";

// Server
export { default as rpcPlugin } from "./server/plugin.js";
export { RpcRouter, createRouter } from "./server/router.js";
export { ConnectionManager } from "./server/connection.js";

// Client
export { RpcClient, createClient, type RpcClientOptions, type RpcClientEvents } from "./client/index.js";
