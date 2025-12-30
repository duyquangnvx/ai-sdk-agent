/**
 * Session Manager
 * Handles session lifecycle: create, resume, pause, delete
 */
import { nanoid } from "nanoid";
import { SESSION_ID_LENGTH, MAX_SESSIONS_PER_PLAYER } from "../shared/constants.js";
import { SessionStore } from "./session-store.js";
import type {
	Session,
	SessionStatus,
	CreateSessionInput,
	ResumeSessionInput,
} from "./types.js";

export class SessionManager {
	private store: SessionStore;

	constructor() {
		this.store = new SessionStore();
	}

	/**
	 * Create a new session for a player
	 */
	createSession(input: CreateSessionInput): Session {
		// Check max sessions per player
		const playerSessions = this.store.getByPlayerId(input.playerId);

		if (playerSessions.length >= MAX_SESSIONS_PER_PLAYER) {
			// Try to remove oldest inactive session
			const inactiveSessions = playerSessions
				.filter((s) => s.status !== "active")
				.sort((a, b) => a.lastActivityAt.getTime() - b.lastActivityAt.getTime());

			if (inactiveSessions.length > 0) {
				this.deleteSession(inactiveSessions[0].id);
			} else {
				throw new Error(
					`Maximum sessions (${MAX_SESSIONS_PER_PLAYER}) reached for player`,
				);
			}
		}

		const session: Session = {
			id: nanoid(SESSION_ID_LENGTH),
			playerId: input.playerId,
			connectionId: input.connectionId ?? null,
			status: input.connectionId ? "active" : "paused",
			createdAt: new Date(),
			lastActivityAt: new Date(),
			metadata: input.metadata ?? {},
		};

		this.store.set(session);
		return session;
	}

	/**
	 * Resume an existing session with a new connection
	 */
	resumeSession(input: ResumeSessionInput): Session | null {
		const session = this.store.get(input.sessionId);
		if (!session) return null;

		// Update session
		session.connectionId = input.connectionId;
		session.status = "active";
		session.lastActivityAt = new Date();

		this.store.set(session);
		return session;
	}

	/**
	 * Bind a connection to a session
	 */
	bindConnection(sessionId: string, connectionId: string): Session | null {
		const session = this.store.get(sessionId);
		if (!session) return null;

		session.connectionId = connectionId;
		session.status = "active";
		session.lastActivityAt = new Date();

		this.store.set(session);
		return session;
	}

	/**
	 * Pause a session (disconnect without deleting)
	 */
	pauseSession(sessionId: string): void {
		const session = this.store.get(sessionId);
		if (!session) return;

		session.connectionId = null;
		session.status = "paused";
		session.lastActivityAt = new Date();

		this.store.set(session);
	}

	/**
	 * Mark session as disconnected
	 */
	disconnectSession(sessionId: string): void {
		const session = this.store.get(sessionId);
		if (!session) return;

		session.connectionId = null;
		session.status = "disconnected";
		session.lastActivityAt = new Date();

		this.store.set(session);
	}

	/**
	 * Update session status
	 */
	updateStatus(sessionId: string, status: SessionStatus): void {
		const session = this.store.get(sessionId);
		if (!session) return;

		session.status = status;
		session.lastActivityAt = new Date();

		this.store.set(session);
	}

	/**
	 * Touch session (update lastActivityAt)
	 */
	touchSession(sessionId: string): void {
		const session = this.store.get(sessionId);
		if (!session) return;

		session.lastActivityAt = new Date();
		this.store.set(session);
	}

	/**
	 * Delete a session
	 */
	deleteSession(sessionId: string): boolean {
		return this.store.delete(sessionId);
	}

	/**
	 * Get session by ID
	 */
	getSession(sessionId: string): Session | null {
		return this.store.get(sessionId);
	}

	/**
	 * Get session by connection ID
	 */
	getSessionByConnectionId(connectionId: string): Session | null {
		return this.store.getByConnectionId(connectionId);
	}

	/**
	 * Get all sessions for a player
	 */
	getPlayerSessions(playerId: string): Session[] {
		return this.store.getByPlayerId(playerId);
	}

	/**
	 * Get all active sessions
	 */
	getActiveSessions(): Session[] {
		return this.store.getAll().filter((s) => s.status === "active");
	}

	/**
	 * Get total session count
	 */
	get sessionCount(): number {
		return this.store.size;
	}
}
