import fp from "fastify-plugin";
import websocket from "@fastify/websocket";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { RpcPluginOptions, RpcHooks } from "../types.js";
import { RpcRouter } from "./router.js";
import { ConnectionManager } from "./connection.js";
import { createConnectionHandler } from "./handler.js";

interface ResolvedOptions {
  path: string;
  timeout: number;
  hooks: RpcHooks;
  heartbeatInterval: number;
  maxPayloadLength: number;
}

const DEFAULT_OPTIONS: ResolvedOptions = {
  path: "/ws",
  timeout: 30000,
  hooks: {},
  heartbeatInterval: 30000,
  maxPayloadLength: 1024 * 1024, // 1MB
};

/**
 * WebSocket RPC Fastify Plugin
 */
const rpcPlugin: FastifyPluginAsync<RpcPluginOptions> = async (
  fastify: FastifyInstance,
  opts: RpcPluginOptions,
) => {
  const options: ResolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...opts,
    hooks: { ...DEFAULT_OPTIONS.hooks, ...opts.hooks },
  };

  // Register @fastify/websocket if not already registered
  if (!fastify.hasDecorator("websocketServer")) {
    await fastify.register(websocket, {
      options: {
        maxPayload: options.maxPayloadLength,
      },
    });
  }

  // Create shared instances
  const router = new RpcRouter();
  const connections = new ConnectionManager(options.timeout);

  // Decorate fastify instance
  fastify.decorate("rpc", {
    router,
    connections,
    options,
  });

  // Register WebSocket route
  fastify.get(options.path, { websocket: true }, (socket, request) => {
    const handler = createConnectionHandler(fastify, socket, request, options);
    handler.initialize();
  });

  // Cleanup on close
  fastify.addHook("onClose", async () => {
    connections.closeAll();
  });

  fastify.log.info({ path: options.path }, "WebSocket RPC plugin registered");
};

export default fp(rpcPlugin, {
  name: "websocket-rpc",
  fastify: "5.x",
});

// Module augmentation for type safety
declare module "fastify" {
  interface FastifyInstance {
    rpc: {
      router: RpcRouter;
      connections: ConnectionManager;
      options: ResolvedOptions;
    };
  }
}
