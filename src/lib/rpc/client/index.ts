import { RpcError, RpcErrorCode } from "../errors.js";
import {
  RpcMessageSchema,
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
} from "../protocol.js";
import type { MethodRegistry, RpcCaller, CallOptions } from "../types.js";

/**
 * RPC Client options
 */
export interface RpcClientOptions {
  /** WebSocket URL */
  url: string;
  /** Default timeout for RPC calls (ms) */
  timeout?: number;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Initial reconnect delay (ms) */
  reconnectDelay?: number;
  /** Maximum reconnect delay (ms) */
  maxReconnectDelay?: number;
  /** Maximum reconnection attempts (0 = infinite) */
  maxReconnectAttempts?: number;
  /** WebSocket protocols */
  protocols?: string | string[];
}

/**
 * Client event types
 */
export interface RpcClientEvents {
  connect: () => void;
  disconnect: (code: number, reason: string) => void;
  reconnecting: (attempt: number) => void;
  error: (error: Error) => void;
  notification: (method: string, params: unknown) => void;
}

type EventKey = keyof RpcClientEvents;
type EventCallback<K extends EventKey> = RpcClientEvents[K];

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const DEFAULT_OPTIONS = {
  timeout: 30000,
  autoReconnect: true,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  maxReconnectAttempts: 0,
  protocols: undefined,
} as const;

/**
 * WebSocket RPC Client with full type inference
 *
 * @example
 * ```ts
 * const client = new RpcClient<typeof serverMethods>({
 *   url: "ws://localhost:3000/ws",
 * });
 *
 * await client.connect();
 * const user = await client.call["user.get"]({ id: "123" });
 * ```
 */
export class RpcClient<
  TServerMethods extends MethodRegistry = Record<string, never>,
> {
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private eventListeners = new Map<string, Set<Function>>();
  private clientHandlers = new Map<string, (params: unknown) => unknown>();
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isClosing = false;

  private readonly options: Required<Omit<RpcClientOptions, "protocols">> &
    Pick<RpcClientOptions, "protocols">;

  constructor(options: RpcClientOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.isClosing = false;
      this.ws = new WebSocket(this.options.url, this.options.protocols);

      const onOpen = () => {
        cleanup();
        this.reconnectAttempts = 0;
        this.emit("connect");
        resolve();
      };

      const onError = () => {
        cleanup();
        const error = new Error("WebSocket connection error");
        this.emit("error", error);
        reject(error);
      };

      const cleanup = () => {
        this.ws?.removeEventListener("open", onOpen);
        this.ws?.removeEventListener("error", onError);
      };

      this.ws.addEventListener("open", onOpen);
      this.ws.addEventListener("error", onError);

      this.ws.addEventListener("close", (event) => {
        this.handleDisconnect(event.code, event.reason);
      });

      this.ws.addEventListener("message", (event) => {
        this.handleMessage(event.data);
      });
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.isClosing = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    // Reject all pending
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(RpcError.connectionClosed());
    }
    this.pendingRequests.clear();
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Call server methods with full type inference
   *
   * @example
   * ```ts
   * const user = await client.call["user.get"]({ id: "123" });
   * // TypeScript knows user is { id: string, name: string, ... }
   * ```
   */
  call: RpcCaller<TServerMethods> = new Proxy({} as RpcCaller<TServerMethods>, {
    get: (_, method: string) => {
      return (params: unknown, options?: CallOptions) => {
        return this.callMethod(method, params, options);
      };
    },
  });

  /**
   * Register a handler for server-to-client calls
   *
   * @example
   * ```ts
   * client.handle("client.notify", (params) => {
   *   console.log("Notification:", params);
   *   return { received: true };
   * });
   * ```
   */
  handle<TParams = unknown, TResult = unknown>(
    method: string,
    handler: (params: TParams) => TResult | Promise<TResult>,
  ): void {
    this.clientHandlers.set(method, handler as (params: unknown) => unknown);
  }

  /**
   * Send a notification to the server (no response expected)
   */
  notify(method: string, params?: unknown): void {
    this.send(createNotification(method, params));
  }

  /**
   * Subscribe to client events
   */
  on<K extends EventKey>(event: K, callback: EventCallback<K>): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from client events
   */
  off<K extends EventKey>(event: K, callback: EventCallback<K>): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  /**
   * Call a method on the server
   */
  private callMethod(
    method: string,
    params: unknown,
    options?: CallOptions,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(RpcError.connectionClosed());
        return;
      }

      const id = generateMessageId();
      const timeout = options?.timeout ?? this.options.timeout;

      // Handle abort signal
      if (options?.signal) {
        if (options.signal.aborted) {
          reject(RpcError.timeout(0));
          return;
        }
        options.signal.addEventListener("abort", () => {
          const pending = this.pendingRequests.get(id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(id);
            reject(RpcError.timeout(0));
          }
        });
      }

      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(RpcError.timeout(timeout));
      }, timeout);

      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      this.send(createRequest(id, method, params));
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string | ArrayBuffer | Blob): void {
    const text = typeof data === "string" ? data : new TextDecoder().decode(data as ArrayBuffer);

    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      this.emit("error", new Error("Failed to parse message"));
      return;
    }

    const parseResult = RpcMessageSchema.safeParse(message);
    if (!parseResult.success) {
      this.emit("error", new Error("Invalid message format"));
      return;
    }

    const msg = parseResult.data;

    if (isResponse(msg)) {
      this.handleResponse(msg);
    } else if (isRequest(msg)) {
      this.handleServerRequest(msg);
    } else if (isNotification(msg)) {
      this.emit("notification", msg.method, msg.params);
    }
  }

  /**
   * Handle response from server
   */
  private handleResponse(msg: RpcResponse): void {
    const pending = this.pendingRequests.get(msg.id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(msg.id);

    if (msg.error) {
      pending.reject(RpcError.fromJSON(msg.error));
    } else {
      pending.resolve(msg.result);
    }
  }

  /**
   * Handle request from server (server calling client)
   */
  private async handleServerRequest(msg: RpcRequest): Promise<void> {
    const handler = this.clientHandlers.get(msg.method);

    if (!handler) {
      this.send(
        createErrorResponse(
          msg.id,
          RpcErrorCode.METHOD_NOT_FOUND,
          `Method not found: ${msg.method}`,
        ),
      );
      return;
    }

    try {
      const result = await handler(msg.params);
      this.send(createResponse(msg.id, result));
    } catch (error) {
      const rpcError =
        error instanceof RpcError
          ? error
          : RpcError.internalError(
              error instanceof Error ? error.message : "Handler error",
            );
      this.send(
        createErrorResponse(msg.id, rpcError.code, rpcError.message, rpcError.data),
      );
    }
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(code: number, reason: string): void {
    // Reject all pending requests
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(RpcError.connectionClosed());
    }
    this.pendingRequests.clear();

    this.emit("disconnect", code, reason);

    // Auto-reconnect logic
    if (
      this.options.autoReconnect &&
      !this.isClosing &&
      (this.options.maxReconnectAttempts === 0 ||
        this.reconnectAttempts < this.options.maxReconnectAttempts)
    ) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    const delay = Math.min(
      this.options.reconnectDelay * 2 ** this.reconnectAttempts,
      this.options.maxReconnectDelay,
    );

    this.reconnectAttempts++;
    this.emit("reconnecting", this.reconnectAttempts);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
      } catch {
        // Will trigger handleDisconnect which will schedule another reconnect
      }
    }, delay);
  }

  /**
   * Send data through WebSocket
   */
  private send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  /**
   * Emit event to listeners
   */
  private emit<K extends EventKey>(
    event: K,
    ...args: Parameters<RpcClientEvents[K]>
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        listener(...args);
      }
    }
  }
}

/**
 * Create a new RPC client
 */
export function createClient<T extends MethodRegistry>(
  options: RpcClientOptions,
): RpcClient<T> {
  return new RpcClient<T>(options);
}
