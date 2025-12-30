/**
 * Game Routes
 * Aggregates all game-related routes
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import sessionsRoutes from "./sessions.js";
import chatRoutes from "./chat.js";
import chatStreamRoutes from "./chat-stream.js";

const gameRoutes: FastifyPluginAsyncZod = async (fastify) => {
	await fastify.register(sessionsRoutes);
	await fastify.register(chatRoutes);
	await fastify.register(chatStreamRoutes);
};

export default gameRoutes;
