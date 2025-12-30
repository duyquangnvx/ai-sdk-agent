/**
 * Export all interaction tool definitions
 */
import { createToolkit } from "@voltagent/core";
import { askUserTool } from "./ask-user.js";

export const interactionTools = [askUserTool];

/**
 * Interaction Toolkit - Tools for user interaction
 * Used by GameAssistant
 */
export const interactionToolkit = createToolkit({
	name: "interaction_toolkit",
	description: "Tools for interacting with the user",
	instructions: `Use ask_user when you need specific information from the user.

Best practices:
- Ask clear, concise questions
- Provide helpful options when possible
- Use appropriate question types:
  - single_choice: When user must pick one option
  - multiple_choice: When user can select multiple options
  - text: When you need free-form input
  - number: When you need a numeric value
  - confirm: When you need a yes/no answer
- Group related questions together (max 5 per call)
- Mark questions as required only when necessary`,
	addInstructions: true,
	tools: interactionTools,
});
