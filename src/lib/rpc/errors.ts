/**
 * Standard JSON-RPC 2.0 error codes
 */
export enum RpcErrorCode {
  /** Invalid JSON was received */
  PARSE_ERROR = -32700,
  /** The JSON sent is not a valid Request object */
  INVALID_REQUEST = -32600,
  /** The method does not exist / is not available */
  METHOD_NOT_FOUND = -32601,
  /** Invalid method parameter(s) */
  INVALID_PARAMS = -32602,
  /** Internal JSON-RPC error */
  INTERNAL_ERROR = -32603,

  // Custom error codes (-32000 to -32099)
  /** Request timed out */
  TIMEOUT = -32000,
  /** Connection was closed */
  CONNECTION_CLOSED = -32001,
  /** Unauthorized access */
  UNAUTHORIZED = -32002,
  /** Rate limited */
  RATE_LIMITED = -32003,
}

/**
 * RPC Error class
 */
export class RpcError extends Error {
  readonly code: number;
  readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = "RpcError";
    this.code = code;
    this.data = data;

    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RpcError);
    }
  }

  /**
   * Convert to JSON-RPC error object
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }

  /**
   * Create from JSON-RPC error object
   */
  static fromJSON(obj: { code: number; message: string; data?: unknown }): RpcError {
    return new RpcError(obj.code, obj.message, obj.data);
  }

  // Factory methods for common errors
  static parseError(data?: unknown): RpcError {
    return new RpcError(RpcErrorCode.PARSE_ERROR, "Parse error", data);
  }

  static invalidRequest(data?: unknown): RpcError {
    return new RpcError(RpcErrorCode.INVALID_REQUEST, "Invalid request", data);
  }

  static methodNotFound(method: string): RpcError {
    return new RpcError(
      RpcErrorCode.METHOD_NOT_FOUND,
      `Method not found: ${method}`,
    );
  }

  static invalidParams(data?: unknown): RpcError {
    return new RpcError(RpcErrorCode.INVALID_PARAMS, "Invalid params", data);
  }

  static internalError(message?: string, data?: unknown): RpcError {
    return new RpcError(
      RpcErrorCode.INTERNAL_ERROR,
      message ?? "Internal error",
      data,
    );
  }

  static timeout(timeoutMs: number): RpcError {
    return new RpcError(
      RpcErrorCode.TIMEOUT,
      `Request timed out after ${timeoutMs}ms`,
    );
  }

  static connectionClosed(): RpcError {
    return new RpcError(RpcErrorCode.CONNECTION_CLOSED, "Connection closed");
  }

  static unauthorized(message?: string): RpcError {
    return new RpcError(
      RpcErrorCode.UNAUTHORIZED,
      message ?? "Unauthorized",
    );
  }

  static rateLimited(): RpcError {
    return new RpcError(RpcErrorCode.RATE_LIMITED, "Rate limited");
  }
}
