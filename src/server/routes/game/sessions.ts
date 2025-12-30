/**
 * Session Routes
 * Handle session CRUD operations
 */
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { API_PATHS } from "../../../shared/constants.js";

// Schemas
const SessionSchema = z.object({
	id: z.string(),
	playerId: z.string(),
	connectionId: z.string().nullable(),
	status: z.enum(["active", "paused", "disconnected", "expired"]),
	createdAt: z.string().datetime(),
	lastActivityAt: z.string().datetime(),
	metadata: z.record(z.unknown()),
});

const CreateSessionBodySchema = z.object({
	playerId: z.string().min(1),
	metadata: z.record(z.unknown()).optional(),
});

const CreateSessionResponseSchema = z.object({
	session: SessionSchema,
});

const ListSessionsResponseSchema = z.object({
	sessions: z.array(SessionSchema),
});

const GetSessionResponseSchema = z.object({
	session: SessionSchema,
});

const sessionsRoutes: FastifyPluginAsyncZod = async (fastify) => {
	/**
	 * POST /api/game/sessions - Create a new session
	 */
	fastify.post(
		API_PATHS.SESSIONS,
		{
			schema: {
				body: CreateSessionBodySchema,
				response: {
					201: CreateSessionResponseSchema,
				},
			},
		},
		async (request, reply) => {
			const { playerId, metadata } = request.body;

			const session = fastify.sessionManager.createSession({
				playerId,
				metadata,
			});

			return reply.status(201).send({
				session: {
					...session,
					createdAt: session.createdAt.toISOString(),
					lastActivityAt: session.lastActivityAt.toISOString(),
				},
			});
		},
	);

	/**
	 * GET /api/game/sessions - List sessions for a player
	 */
	fastify.get(
		API_PATHS.SESSIONS,
		{
			schema: {
				querystring: z.object({
					playerId: z.string().min(1),
				}),
				response: {
					200: ListSessionsResponseSchema,
				},
			},
		},
		async (request) => {
			const { playerId } = request.query;
			const sessions = fastify.sessionManager.getPlayerSessions(playerId);

			return {
				sessions: sessions.map((s) => ({
					...s,
					createdAt: s.createdAt.toISOString(),
					lastActivityAt: s.lastActivityAt.toISOString(),
				})),
			};
		},
	);

	/**
	 * GET /api/game/sessions/:id - Get a specific session
	 */
	fastify.get(
		`${API_PATHS.SESSIONS}/:id`,
		{
			schema: {
				params: z.object({
					id: z.string(),
				}),
				response: {
					200: GetSessionResponseSchema,
				},
			},
		},
		async (request, reply) => {
			const { id } = request.params;
			const session = fastify.sessionManager.getSession(id);

			if (!session) {
				return reply.notFound("Session not found");
			}

			return {
				session: {
					...session,
					createdAt: session.createdAt.toISOString(),
					lastActivityAt: session.lastActivityAt.toISOString(),
				},
			};
		},
	);

	/**
	 * DELETE /api/game/sessions/:id - Delete a session
	 */
	fastify.delete(
		`${API_PATHS.SESSIONS}/:id`,
		{
			schema: {
				params: z.object({
					id: z.string(),
				}),
				response: {
					200: z.object({ success: z.boolean() }),
				},
			},
		},
		async (request, reply) => {
			const { id } = request.params;
			const session = fastify.sessionManager.getSession(id);

			if (!session) {
				return reply.notFound("Session not found");
			}

			// Also delete context
			fastify.contextManager.deleteContext(id);
			const deleted = fastify.sessionManager.deleteSession(id);

			return { success: deleted };
		},
	);
};

export default sessionsRoutes;
