/**
 * Session management types
 */

/**
 * Session status
 */
export type SessionStatus = "active" | "paused" | "disconnected" | "expired";

/**
 * Session metadata
 */
export interface SessionMetadata {
	gameName?: string;
	clientVersion?: string;
	[key: string]: unknown;
}

/**
 * Session entity
 */
export interface Session {
	id: string;
	playerId: string;
	connectionId: string | null;
	status: SessionStatus;
	createdAt: Date;
	lastActivityAt: Date;
	metadata: SessionMetadata;
}

/**
 * Input for creating a new session
 */
export interface CreateSessionInput {
	playerId: string;
	connectionId?: string;
	metadata?: SessionMetadata;
}

/**
 * Input for resuming a session
 */
export interface ResumeSessionInput {
	sessionId: string;
	connectionId: string;
}
