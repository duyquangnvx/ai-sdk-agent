import type { WebSocket } from "ws";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { RpcConnection, RpcContext, RpcHooks } from "../types.js";
import { RpcError, RpcErrorCode } from "../errors.js";
import {
  RpcMessageSchema,
  isRequest,
  isResponse,
  isNotification,
  createResponse,
  createErrorResponse,
  generateMessageId,
  type RpcRequest,
  type RpcResponse,
  type RpcNotification,
} from "../protocol.js";

interface HandlerOptions {
  timeout: number;
  hooks: RpcHooks;
  heartbeatInterval: number;
}

/**
 * Create a message handler for a WebSocket connection
 */
export function createConnectionHandler(
  fastify: FastifyInstance,
  socket: WebSocket,
  request: FastifyRequest,
  options: HandlerOptions,
) {
  const connectionId = generateMessageId();
  const log = fastify.log.child({ connectionId });

  const connection: RpcConnection = {
    id: connectionId,
    socket,
    request,
    metadata: {},
    createdAt: new Date(),
    lastActivityAt: new Date(),
  };

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Send data through WebSocket
   */
  function send(data: unknown): void {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }

  /**
   * Handle incoming message
   */
  async function handleMessage(data: Buffer | string): Promise<void> {
    connection.lastActivityAt = new Date();

    let message: unknown;
    try {
      message = JSON.parse(data.toString());
    } catch {
      send(createErrorResponse("null", RpcErrorCode.PARSE_ERROR, "Invalid JSON"));
      return;
    }

    const parseResult = RpcMessageSchema.safeParse(message);
    if (!parseResult.success) {
      send(
        createErrorResponse(
          "null",
          RpcErrorCode.INVALID_REQUEST,
          "Invalid message format",
          parseResult.error.issues,
        ),
      );
      return;
    }

    const msg = parseResult.data;

    try {
      if (isRequest(msg)) {
        await handleRequest(msg);
      } else if (isResponse(msg)) {
        handleResponse(msg);
      } else if (isNotification(msg)) {
        await handleNotification(msg);
      }
    } catch (error) {
      log.error({ error }, "Error handling message");
    }
  }

  /**
   * Handle RPC request
   */
  async function handleRequest(msg: RpcRequest): Promise<void> {
    const { id, method, params } = msg;

    const handlerEntry = fastify.rpc.router.getHandler(method);
    if (!handlerEntry) {
      send(
        createErrorResponse(
          id,
          RpcErrorCode.METHOD_NOT_FOUND,
          `Method not found: ${method}`,
        ),
      );
      return;
    }

    const { def, handler } = handlerEntry;

    // Validate input
    const inputResult = def.input.safeParse(params);
    if (!inputResult.success) {
      send(
        createErrorResponse(
          id,
          RpcErrorCode.INVALID_PARAMS,
          "Invalid parameters",
          inputResult.error.issues,
        ),
      );
      return;
    }

    // Build context
    const ctx: RpcContext = {
      params: inputResult.data,
      connection,
      request,
      app: fastify,
      connections: fastify.rpc.connections,
      log,
    };

    try {
      // Run onRequest hook
      if (options.hooks.onRequest) {
        await options.hooks.onRequest(ctx, method);
      }

      // Execute handler
      const result = await handler(ctx);

      // Validate output
      const outputResult = def.output.safeParse(result);
      if (!outputResult.success) {
        log.error({ error: outputResult.error }, "Output validation failed");
        send(
          createErrorResponse(
            id,
            RpcErrorCode.INTERNAL_ERROR,
            "Invalid response format",
          ),
        );
        return;
      }

      // Send response
      send(createResponse(id, outputResult.data));

      // Run onResponse hook
      if (options.hooks.onResponse) {
        await options.hooks.onResponse(ctx, method, outputResult.data);
      }
    } catch (error) {
      const rpcError =
        error instanceof RpcError
          ? error
          : RpcError.internalError(
              error instanceof Error ? error.message : "Unknown error",
            );

      send(createErrorResponse(id, rpcError.code, rpcError.message, rpcError.data));

      if (options.hooks.onError) {
        await options.hooks.onError(ctx, error as Error, method);
      }
    }
  }

  /**
   * Handle RPC response (from client to server's call)
   */
  function handleResponse(msg: RpcResponse): void {
    fastify.rpc.connections.handleResponse(
      connectionId,
      msg.id,
      msg.result,
      msg.error,
    );
  }

  /**
   * Handle notification (fire-and-forget from client)
   */
  async function handleNotification(msg: RpcNotification): Promise<void> {
    log.debug({ method: msg.method }, "Received notification");
    // Can be extended to handle client notifications
  }

  /**
   * Handle connection close
   */
  function handleClose(code: number, reason: Buffer): void {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }

    fastify.rpc.connections.remove(connectionId);

    if (options.hooks.onDisconnect) {
      options.hooks.onDisconnect(connection, code, reason.toString());
    }

    log.info({ code, reason: reason.toString() }, "Connection closed");
  }

  /**
   * Handle WebSocket error
   */
  function handleError(error: Error): void {
    log.error({ error }, "WebSocket error");
    if (options.hooks.onError) {
      options.hooks.onError(null, error);
    }
  }

  /**
   * Initialize the connection handler
   */
  function initialize(): void {
    // Register with connection manager
    fastify.rpc.connections.add(connection, send);

    // Set up event handlers
    socket.on("message", handleMessage);
    socket.on("close", handleClose);
    socket.on("error", handleError);

    // Set up heartbeat
    if (options.heartbeatInterval > 0) {
      heartbeatTimer = setInterval(() => {
        if (socket.readyState === socket.OPEN) {
          socket.ping();
        }
      }, options.heartbeatInterval);
    }

    // Run connection hook
    if (options.hooks.onConnection) {
      options.hooks.onConnection(connection);
    }

    log.info("WebSocket RPC connection established");
  }

  return { initialize, connection };
}
