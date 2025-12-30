/**
 * ask_user tool
 * Ask structured questions to the user
 */
import { createTool } from "@voltagent/core";
import { askUserOperation } from "../../../schemas/index.js";
import { tryGetToolContext, noContextError } from "../executor.js";

export const askUserTool = createTool({
	name: "ask_user",
	description: askUserOperation.description,
	parameters: askUserOperation.input,
	execute: async (params) => {
		const ctx = tryGetToolContext();
		if (!ctx) {
			return noContextError();
		}

		const { rpcCaller } = ctx;

		// Send questions to client for user response
		// This will block until user responds (up to 5 minutes)
		const result = await rpcCaller.askUser(params);

		return result;
	},
});
