/**
 * get_game_settings tool
 * Get current game settings
 */
import { createTool } from "@voltagent/core";
import {
	getSettingsOperation,
	createToolOutputSchema,
} from "../../../schemas/index.js";
import { tryGetToolContext, noContextError } from "../executor.js";

export const getGameSettingsTool = createTool({
	name: "get_game_settings",
	description: getSettingsOperation.description,
	parameters: getSettingsOperation.input,
	// outputSchema: createToolOutputSchema(getSettingsOperation.output),
	execute: async () => {
		const ctx = tryGetToolContext();
		if (!ctx) {
			return noContextError();
		}

		const { rpcCaller, contextManager, sessionId } = ctx;
		const result = await rpcCaller.getSettings();

		if (result.success) {
			// Update context with settings
			contextManager.updateSettings(sessionId, result.data.settings);
		}

		return result;
	},
});
