/**
 * Chat Stream Route
 * Handle AI chat interactions with SSE streaming
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { gameAssistant } from "../../../ai/agents/main-agent.js";
import { runWithToolContext } from "../../../ai/tools/executor.js";
import { createGameRpcCaller } from "../../../rpc/index.js";
import { buildContext } from "../../../context/index.js";

const ChatStreamRequestSchema = z.object({
	sessionId: z.string().min(1),
	message: z.string().min(1).max(4000),
});

/**
 * SSE Event Types:
 * - text-delta: Partial text content
 * - tool-call: Tool was called
 * - tool-result: Tool returned result
 * - finish: Stream completed
 * - error: Error occurred
 */

const chatStreamRoutes: FastifyPluginAsyncZod = async (fastify) => {
	/**
	 * POST /api/game/chat/stream - Stream chat response via SSE
	 */
	fastify.post(
		"/api/game/chat/stream",
		{
			schema: {
				body: ChatStreamRequestSchema,
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
			const sessionContext =
				fastify.contextManager.getOrCreateSessionContext(sessionId);

			// Create RPC caller for this connection
			const rpcCaller = createGameRpcCaller(
				fastify.rpc.connections,
				session.connectionId,
			);

			// Build context for LLM
			const gameContext = buildContext(sessionContext);

			// Set SSE headers
			reply.raw.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
				"Access-Control-Allow-Origin": "*",
			});

			// Helper to send SSE events
			const sendEvent = (event: string, data: unknown) => {
				reply.raw.write(`event: ${event}\n`);
				reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
			};

			try {
				// Run with tool execution context
				await runWithToolContext(
					{
						sessionId,
						rpcCaller,
						contextManager: fastify.contextManager,
					},
					async () => {
						const result = await gameAssistant.streamText(message, {
							userId: session.playerId,
							conversationId: sessionId,
							context: gameContext as unknown as Record<string, unknown>,
							maxSteps: 30,
						});

						// Stream full events (includes tool calls, text, etc.)
						for await (const part of result.fullStream) {
							switch (part.type) {
								case "text-delta":
									sendEvent("text-delta", { text: part.text });
									break;

								case "tool-call":
									sendEvent("tool-call", {
										toolCallId: part.toolCallId,
										toolName: part.toolName,
										args: "args" in part ? part.args : part.input,
									});
									break;

								case "tool-result":
									sendEvent("tool-result", {
										toolCallId: part.toolCallId,
										toolName: part.toolName,
										result: "result" in part ? part.result : part.output,
									});
									break;

								case "finish":
									sendEvent("finish", {
										finishReason: part.finishReason,
										usage: part.totalUsage,
									});
									break;

								case "error":
									sendEvent("error", {
										error: String(part.error),
									});
									break;
							}
						}

						// Signal stream complete (don't send text again - already streamed)
						sendEvent("done", { complete: true });
					},
				);

				// Update session activity
				fastify.sessionManager.touchSession(sessionId);
			} catch (error) {
				fastify.log.error({ error, sessionId }, "Chat stream error");

				sendEvent("error", {
					error: error instanceof Error ? error.message : "Unknown error",
				});
			} finally {
				reply.raw.end();
			}
		},
	);
};

export default chatStreamRoutes;
