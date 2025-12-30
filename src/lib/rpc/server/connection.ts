import type { RpcConnection, CallOptions } from "../types.js";
import { RpcError, RpcErrorCode } from "../errors.js";
import {
  generateMessageId,
  createRequest,
  createNotification,
} from "../protocol.js";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface ConnectionEntry {
  connection: RpcConnection;
  pendingRequests: Map<string, PendingRequest>;
  send: (data: unknown) => void;
}

/**
 * Connection Manager - tracks connections and enables server-to-client calls
 */
export class ConnectionManager {
  private connections = new Map<string, ConnectionEntry>();
  private defaultTimeout: number;

  constructor(defaultTimeout = 30000) {
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Add a new connection
   */
  add(connection: RpcConnection, send: (data: unknown) => void): void {
    this.connections.set(connection.id, {
      connection,
      pendingRequests: new Map(),
      send,
    });
  }

  /**
   * Remove a connection
   */
  remove(connectionId: string): void {
    const entry = this.connections.get(connectionId);
    if (entry) {
      // Reject all pending requests
      for (const pending of entry.pendingRequests.values()) {
        clearTimeout(pending.timeout);
        pending.reject(RpcError.connectionClosed());
      }
      this.connections.delete(connectionId);
    }
  }

  /**
   * Get connection by ID
   */
  get(connectionId: string): RpcConnection | undefined {
    return this.connections.get(connectionId)?.connection;
  }

  /**
   * Get all connections
   */
  getAll(): RpcConnection[] {
    return Array.from(this.connections.values()).map((e) => e.connection);
  }

  /**
   * Find connections matching a predicate
   */
  find(predicate: (conn: RpcConnection) => boolean): RpcConnection[] {
    return this.getAll().filter(predicate);
  }

  /**
   * Get connections by user ID
   */
  getByUserId(userId: string): RpcConnection[] {
    return this.find((conn) => conn.metadata.userId === userId);
  }

  /**
   * Get connection count
   */
  get size(): number {
    return this.connections.size;
  }

  /**
   * Call a method on a specific client and wait for response
   */
  call<TResult = unknown>(
    connectionId: string,
    method: string,
    params?: unknown,
    options?: CallOptions,
  ): Promise<TResult> {
    const entry = this.connections.get(connectionId);
    if (!entry) {
      return Promise.reject(
        new RpcError(RpcErrorCode.CONNECTION_CLOSED, "Connection not found"),
      );
    }

    return new Promise((resolve, reject) => {
      const id = generateMessageId();
      const timeout = options?.timeout ?? this.defaultTimeout;

      // Handle abort signal
      if (options?.signal) {
        if (options.signal.aborted) {
          reject(RpcError.timeout(0));
          return;
        }
        options.signal.addEventListener("abort", () => {
          const pending = entry.pendingRequests.get(id);
          if (pending) {
            clearTimeout(pending.timeout);
            entry.pendingRequests.delete(id);
            reject(RpcError.timeout(0));
          }
        });
      }

      const timeoutHandle = setTimeout(() => {
        entry.pendingRequests.delete(id);
        reject(RpcError.timeout(timeout));
      }, timeout);

      entry.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutHandle,
      });

      entry.send(createRequest(id, method, params));
    });
  }

  /**
   * Handle a response from a client
   */
  handleResponse(
    connectionId: string,
    id: string,
    result?: unknown,
    error?: { code: number; message: string; data?: unknown },
  ): void {
    const entry = this.connections.get(connectionId);
    if (!entry) return;

    const pending = entry.pendingRequests.get(id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    entry.pendingRequests.delete(id);

    if (error) {
      pending.reject(RpcError.fromJSON(error));
    } else {
      pending.resolve(result);
    }
  }

  /**
   * Send a notification to a specific client (no response expected)
   */
  notify(connectionId: string, method: string, params?: unknown): void {
    const entry = this.connections.get(connectionId);
    if (entry) {
      entry.send(createNotification(method, params));
    }
  }

  /**
   * Broadcast a notification to all connections
   */
  broadcast(method: string, params?: unknown): void {
    const message = createNotification(method, params);
    for (const entry of this.connections.values()) {
      entry.send(message);
    }
  }

  /**
   * Broadcast to connections matching a predicate
   */
  broadcastTo(
    predicate: (conn: RpcConnection) => boolean,
    method: string,
    params?: unknown,
  ): void {
    const message = createNotification(method, params);
    for (const entry of this.connections.values()) {
      if (predicate(entry.connection)) {
        entry.send(message);
      }
    }
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const entry of this.connections.values()) {
      for (const pending of entry.pendingRequests.values()) {
        clearTimeout(pending.timeout);
        pending.reject(RpcError.connectionClosed());
      }
      entry.connection.socket.close(1000, "Server shutdown");
    }
    this.connections.clear();
  }
}
