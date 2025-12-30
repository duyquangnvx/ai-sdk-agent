/**
 * LLM Model Configuration
 * Creates the appropriate LLM model based on environment configuration
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { loadEnv, type LLMProvider } from "./env.js";

/**
 * Create LLM model based on environment configuration
 */
export function createLLMModel(): LanguageModel {
	const config = loadEnv();
	const provider = config.LLM_PROVIDER;

	console.log("[LLM Config]", {
		provider,
		model: provider === "google" ? config.GEMINI_MODEL : config.LLM_MODEL,
		hasApiKey: provider === "google" ? !!config.GOOGLE_GENERATIVE_AI_API_KEY : !!config.LLM_API_KEY,
	});

	switch (provider) {
		case "openai-compatible":
			return createOpenAICompatibleModel(config);
		case "google":
			return createGeminiModel(config);
		case "openai":
			return createOpenAIModel(config);
		default:
			throw new Error(`Unknown LLM provider: ${provider satisfies never}`);
	}
}

function createOpenAICompatibleModel(config: ReturnType<typeof loadEnv>): LanguageModel {
	const openaiCompatible = createOpenAICompatible({
		apiKey: config.LLM_API_KEY ?? "",
		baseURL: config.LLM_BASE_URL ?? "",
		name: "openai-compatible",
	});

	return openaiCompatible(config.LLM_MODEL);
}

function createGeminiModel(config: ReturnType<typeof loadEnv>): LanguageModel {
	if (!config.GOOGLE_GENERATIVE_AI_API_KEY) {
		throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is required for Gemini provider");
	}

	// @ai-sdk/google reads GOOGLE_GENERATIVE_AI_API_KEY from env automatically
	return google(config.GEMINI_MODEL);
}

function createOpenAIModel(config: ReturnType<typeof loadEnv>): LanguageModel {
	if (!config.OPENAI_API_KEY) {
		throw new Error("OPENAI_API_KEY is required for OpenAI provider");
	}

	return openai(config.OPENAI_MODEL);
}

/**
 * Singleton LLM model instance
 * Lazy-loaded on first access
 */
let llmModelInstance: LanguageModel | null = null;

export function getLLMModel(): LanguageModel {
	if (!llmModelInstance) {
		llmModelInstance = createLLMModel();
	}
	return llmModelInstance;
}
