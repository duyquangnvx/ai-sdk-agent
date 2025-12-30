import type { z } from "zod";
import type { FastifyBaseLogger, FastifyInstance, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import type { ConnectionManager } from "./server/connection.js";

/**
 * RPC Method Definition with Zod schemas for type inference
 */
export interface RpcMethodDef<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
> {
  input: TInput;
  output: TOutput;
  description?: string;
}

/**
 * Helper to define a method with full type inference
 */
export function defineMethod<
  TInput extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny,
>(def: RpcMethodDef<TInput, TOutput>): RpcMethodDef<TInput, TOutput> {
  return def;
}

/**
 * Extract input type from method definition
 */
export type InferInput<T extends RpcMethodDef> = z.infer<T["input"]>;

/**
 * Extract output type from method definition
 */
export type InferOutput<T extends RpcMethodDef> = z.infer<T["output"]>;

/**
 * Method registry - maps method names to definitions
 */
export type MethodRegistry = Record<string, RpcMethodDef>;

/**
 * Call options for individual RPC requests
 */
export interface CallOptions {
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * Infer typed caller from method registry
 */
export type RpcCaller<T extends MethodRegistry> = {
  [K in keyof T]: (
    params: InferInput<T[K]>,
    options?: CallOptions,
  ) => Promise<InferOutput<T[K]>>;
};

/**
 * Connection metadata - extensible by user
 */
export interface ConnectionMetadata {
  userId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

/**
 * RPC Connection representation
 */
export interface RpcConnection {
  id: string;
  socket: WebSocket;
  request: FastifyRequest;
  metadata: ConnectionMetadata;
  createdAt: Date;
  lastActivityAt: Date;
}

/**
 * Handler context passed to RPC method handlers
 */
export interface RpcContext<TInput = unknown> {
  /** Validated input parameters */
  params: TInput;
  /** The connection that made this request */
  connection: RpcConnection;
  /** Original Fastify request */
  request: FastifyRequest;
  /** Fastify instance */
  app: FastifyInstance;
  /** Connection manager for broadcasting */
  connections: ConnectionManager;
  /** Scoped logger */
  log: FastifyBaseLogger;
}

/**
 * RPC method handler function
 */
export type RpcHandler<TInput = unknown, TOutput = unknown> = (
  ctx: RpcContext<TInput>,
) => Promise<TOutput> | TOutput;

/**
 * Lifecycle hooks for RPC plugin
 */
export interface RpcHooks {
  /** Called when a new connection is established */
  onConnection?: (connection: RpcConnection) => void | Promise<void>;

  /** Called when a connection is closed */
  onDisconnect?: (
    connection: RpcConnection,
    code: number,
    reason: string,
  ) => void | Promise<void>;

  /** Called before a request is processed */
  onRequest?: (ctx: RpcContext, method: string) => void | Promise<void>;

  /** Called after a successful response */
  onResponse?: (
    ctx: RpcContext,
    method: string,
    result: unknown,
  ) => void | Promise<void>;

  /** Called when an error occurs */
  onError?: (
    ctx: RpcContext | null,
    error: Error,
    method?: string,
  ) => void | Promise<void>;

  /** Called before sending a notification to client */
  onNotification?: (
    connection: RpcConnection,
    method: string,
    params: unknown,
  ) => void | Promise<void>;
}

/**
 * WebSocket RPC Plugin options
 */
export interface RpcPluginOptions {
  /** WebSocket endpoint path */
  path?: string;
  /** Default timeout for RPC calls (ms) */
  timeout?: number;
  /** Lifecycle hooks */
  hooks?: RpcHooks;
  /** Heartbeat interval (ms), 0 to disable */
  heartbeatInterval?: number;
  /** Maximum message size in bytes */
  maxPayloadLength?: number;
}
