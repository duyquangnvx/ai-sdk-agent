/**
 * Shared constants for the application
 */

// Session
export const SESSION_ID_LENGTH = 12;
export const MAX_SESSIONS_PER_PLAYER = 10;

// API paths
export const API_BASE_PATH = "/api/game";
export const API_PATHS = {
	SESSIONS: `${API_BASE_PATH}/sessions`,
	CHAT: `${API_BASE_PATH}/chat`,
	TOOL_RESULT: `${API_BASE_PATH}/tool-result`,
	APPROVAL: `${API_BASE_PATH}/approval`,
} as const;
