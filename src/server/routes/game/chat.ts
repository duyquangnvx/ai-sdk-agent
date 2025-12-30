/**
 * Chat Route
 * Handle AI chat interactions with the game assistant
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { API_PATHS } from "../../../shared/constants.js";
import { gameAssistant } from "../../../ai/agents/main-agent.js";
import { runWithToolContext } from "../../../ai/tools/executor.js";
import { createGameRpcCaller } from "../../../rpc/index.js";
import { buildContext } from "../../../context/index.js";

const ChatRequestSchema = z.object({
	sessionId: z.string().min(1),
	message: z.string().min(1).max(4000),
});

const ChatResponseSchema = z.object({
	response: z.string(),
	toolCalls: z
		.array(
			z.object({
				name: z.string(),
				args: z.unknown(),
				result: z.unknown(),
			}),
		)
		.optional(),
});

const chatRoutes: FastifyPluginAsyncZod = async (fastify) => {
	/**
	 * POST /api/game/chat - Send a message to the AI assistant
	 */
	fastify.post(
		API_PATHS.CHAT,
		{
			schema: {
				body: ChatRequestSchema,
				response: {
					200: ChatResponseSchema,
				},
			},
		},
		async (request, reply) => {
			const { sessionId, message } = request.body;

			// Get session
			const session = fastify.sessionManager.getSession(sessionId);
			if (!session) {
				return reply.notFound("Session not found");
			}

			if (!session.connectionId) {
				return reply.badRequest(
					"Session not connected. Please connect via WebSocket first.",
				);
			}

			// Get or create context for this session
			const sessionContext = fastify.contextManager.getOrCreateSessionContext(sessionId);

			// Create RPC caller for this connection
			const rpcCaller = createGameRpcCaller(
				fastify.rpc.connections,
				session.connectionId,
			);

			// Build context for LLM
			const gameContext = buildContext(sessionContext);

			try {
				// Run with tool execution context
				const result = await runWithToolContext(
					{
						sessionId,
						rpcCaller,
						contextManager: fastify.contextManager,
					},
					async () => {
						return gameAssistant.generateText(message, {
							userId: session.playerId,
							conversationId: sessionId,
							context: gameContext as unknown as Record<string, unknown>,
							maxSteps: 30,
						});
					},
				);

				// Update session activity
				fastify.sessionManager.touchSession(sessionId);

				// Extract tool calls if any
				const toolCalls = result.toolResults?.map((tr) => ({
					name: tr.toolName,
					args: "args" in tr ? tr.args : undefined,
					result: "result" in tr ? tr.result : tr.output,
				}));

				console.log("[Chat Response]", {
					result,
					toolCalls,
				});

				return {
					response: result.text ?? "",
					toolCalls: toolCalls?.length ? toolCalls : undefined,
				};
			} catch (error) {
				fastify.log.error({ error, sessionId }, "Chat error");

				if (error instanceof Error) {
					return reply.internalServerError(error.message);
				}

				return reply.internalServerError("An unexpected error occurred");
			}
		},
	);
};

export default chatRoutes;
