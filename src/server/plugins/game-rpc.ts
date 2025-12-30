/**
 * Game RPC Plugin
 * Registers WebSocket RPC with session management hooks
 */
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import rpcPlugin from "../../lib/rpc/server/plugin.js";
import { SessionManager } from "../../sessions/index.js";
import { ContextManager } from "../../context/index.js";

declare module "fastify" {
	interface FastifyInstance {
		sessionManager: SessionManager;
		contextManager: ContextManager;
	}
}

export interface GameRpcPluginOptions {
	/** WebSocket path (default: /ws) */
	path?: string;
	/** Request timeout in ms (default: 30000) */
	timeout?: number;
}

const gameRpcPlugin: FastifyPluginAsync<GameRpcPluginOptions> = async (
	fastify,
	opts,
) => {
	// Create managers
	const sessionManager = new SessionManager();
	const contextManager = new ContextManager();

	// Decorate fastify instance
	fastify.decorate("sessionManager", sessionManager);
	fastify.decorate("contextManager", contextManager);

	// Register base RPC plugin with hooks
	await fastify.register(rpcPlugin, {
		path: opts.path ?? "/ws",
		timeout: opts.timeout ?? 30000,
		hooks: {
			onConnection: async (connection) => {
				fastify.log.info(
					{ connectionId: connection.id },
					"New WebSocket connection",
				);

				// Extract sessionId from query params
				const url = new URL(
					connection.request.url ?? "",
					`http://${connection.request.headers.host}`,
				);
				const sessionId = url.searchParams.get("sessionId");

				if (sessionId) {
					// Try to bind connection to existing session
					const session = sessionManager.bindConnection(
						sessionId,
						connection.id,
					);
					if (session) {
						connection.metadata.sessionId = sessionId;
						connection.metadata.userId = session.playerId;
						fastify.log.info(
							{ connectionId: connection.id, sessionId, playerId: session.playerId },
							"Connection bound to session",
						);
					} else {
						fastify.log.warn(
							{ connectionId: connection.id, sessionId },
							"Session not found for binding",
						);
					}
				}
			},

			onDisconnect: async (connection, code, reason) => {
				fastify.log.info(
					{ connectionId: connection.id, code, reason },
					"WebSocket disconnected",
				);

				// Find and pause session
				const session = sessionManager.getSessionByConnectionId(connection.id);
				if (session) {
					sessionManager.disconnectSession(session.id);
					fastify.log.info(
						{ sessionId: session.id, playerId: session.playerId },
						"Session disconnected",
					);
				}
			},

			onRequest: async (ctx, method) => {
				fastify.log.debug(
					{ method, connectionId: ctx.connection.id },
					"RPC request",
				);

				// Touch session to update lastActivityAt
				const sessionId = ctx.connection.metadata.sessionId as string | undefined;
				if (sessionId) {
					sessionManager.touchSession(sessionId);
				}
			},

			onError: async (ctx, error, method) => {
				fastify.log.error(
					{ error: error.message, method, connectionId: ctx?.connection?.id },
					"RPC error",
				);
			},
		},
	});

	fastify.log.info("Game RPC plugin registered");
};

export default fp(gameRpcPlugin, {
	name: "game-rpc",
	fastify: "5.x",
});
