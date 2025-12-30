/**
 * Prompt loader
 * Loads static prompts from text files
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Get current directory for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load prompt from text file
 */
const loadPrompt = (filename: string): string => {
	const filepath = join(__dirname, filename);
	return readFileSync(filepath, "utf-8");
};

// Export loaded prompts
export const MAIN_AGENT_PROMPT = loadPrompt("main-agent.txt");
export const PLANNING_PROMPT = loadPrompt("planning.txt");
export const SCRIPT_AGENT_PROMPT = loadPrompt("script-agent.txt");
