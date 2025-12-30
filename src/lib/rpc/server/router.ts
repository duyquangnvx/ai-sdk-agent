import type { z } from "zod";
import type { RpcMethodDef, RpcHandler } from "../types.js";

interface HandlerEntry {
  def: RpcMethodDef;
  handler: RpcHandler;
}

/**
 * RPC Router - registers method handlers with full type inference
 */
export class RpcRouter<
  TRegistry extends Record<string, RpcMethodDef> = Record<string, never>,
> {
  private handlers = new Map<string, HandlerEntry>();

  /**
   * Register a method handler
   *
   * @example
   * ```ts
   * router.method("user.get", {
   *   input: z.object({ id: z.string() }),
   *   output: z.object({ name: z.string() }),
   * }, async (ctx) => {
   *   return { name: "John" };
   * });
   * ```
   */
  method<
    TMethod extends string,
    TInput extends z.ZodTypeAny,
    TOutput extends z.ZodTypeAny,
  >(
    name: TMethod,
    def: RpcMethodDef<TInput, TOutput>,
    handler: RpcHandler<z.infer<TInput>, z.infer<TOutput>>,
  ): RpcRouter<TRegistry & Record<TMethod, RpcMethodDef<TInput, TOutput>>> {
    this.handlers.set(name, {
      def,
      handler: handler as RpcHandler,
    });
    return this as RpcRouter<
      TRegistry & Record<TMethod, RpcMethodDef<TInput, TOutput>>
    >;
  }

  /**
   * Get handler entry for a method
   */
  getHandler(method: string): HandlerEntry | undefined {
    return this.handlers.get(method);
  }

  /**
   * Check if method exists
   */
  hasMethod(method: string): boolean {
    return this.handlers.has(method);
  }

  /**
   * Get all registered method names
   */
  getMethods(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Merge another router into this one
   */
  merge<TOther extends Record<string, RpcMethodDef>>(
    router: RpcRouter<TOther>,
  ): RpcRouter<TRegistry & TOther> {
    for (const [name, entry] of (router as unknown as RpcRouter).handlers) {
      this.handlers.set(name, entry);
    }
    return this as RpcRouter<TRegistry & TOther>;
  }
}

/**
 * Create a new RPC router
 */
export function createRouter(): RpcRouter {
  return new RpcRouter();
}
