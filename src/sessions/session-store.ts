/**
 * In-memory session storage
 */
import type { Session } from "./types.js";

/**
 * Simple in-memory store for sessions
 * Uses Map for O(1) lookup by session ID
 * Maintains secondary index for player ID lookup
 */
export class SessionStore {
	private sessions: Map<string, Session> = new Map();
	private playerIndex: Map<string, Set<string>> = new Map();
	private connectionIndex: Map<string, string> = new Map(); // connectionId -> sessionId

	/**
	 * Get session by ID
	 */
	get(sessionId: string): Session | null {
		return this.sessions.get(sessionId) ?? null;
	}

	/**
	 * Get session by connection ID
	 */
	getByConnectionId(connectionId: string): Session | null {
		const sessionId = this.connectionIndex.get(connectionId);
		if (!sessionId) return null;
		return this.get(sessionId);
	}

	/**
	 * Get all sessions for a player
	 */
	getByPlayerId(playerId: string): Session[] {
		const sessionIds = this.playerIndex.get(playerId);
		if (!sessionIds) return [];
		return Array.from(sessionIds)
			.map((id) => this.sessions.get(id))
			.filter((s): s is Session => s !== undefined);
	}

	/**
	 * Store a session
	 */
	set(session: Session): void {
		const existing = this.sessions.get(session.id);

		// Update connection index
		if (existing?.connectionId && existing.connectionId !== session.connectionId) {
			this.connectionIndex.delete(existing.connectionId);
		}
		if (session.connectionId) {
			this.connectionIndex.set(session.connectionId, session.id);
		}

		// Update player index
		if (!this.playerIndex.has(session.playerId)) {
			this.playerIndex.set(session.playerId, new Set());
		}
		this.playerIndex.get(session.playerId)!.add(session.id);

		// Store session
		this.sessions.set(session.id, session);
	}

	/**
	 * Delete a session
	 */
	delete(sessionId: string): boolean {
		const session = this.sessions.get(sessionId);
		if (!session) return false;

		// Remove from connection index
		if (session.connectionId) {
			this.connectionIndex.delete(session.connectionId);
		}

		// Remove from player index
		const playerSessions = this.playerIndex.get(session.playerId);
		if (playerSessions) {
			playerSessions.delete(sessionId);
			if (playerSessions.size === 0) {
				this.playerIndex.delete(session.playerId);
			}
		}

		// Remove session
		return this.sessions.delete(sessionId);
	}

	/**
	 * Get total session count
	 */
	get size(): number {
		return this.sessions.size;
	}

	/**
	 * Get all sessions
	 */
	getAll(): Session[] {
		return Array.from(this.sessions.values());
	}

	/**
	 * Clear all sessions
	 */
	clear(): void {
		this.sessions.clear();
		this.playerIndex.clear();
		this.connectionIndex.clear();
	}
}
