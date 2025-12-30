/**
 * Get Settings Operation
 * Shared schema for RPC method and LLM tool
 */
import { z } from "zod";
import { GameSettingsSchema } from "../../entities/index.js";

export const getSettingsOperation = {
	name: "get_game_settings",
	rpcMethod: "game.getSettings",
	description: "Get current game settings including name, camera configuration, and block count.",

	input: z.object({}),

	output: z.object({
		settings: GameSettingsSchema,
	}),
} as const;

export type GetSettingsInput = z.infer<typeof getSettingsOperation.input>;
export type GetSettingsOutput = z.infer<typeof getSettingsOperation.output>;
