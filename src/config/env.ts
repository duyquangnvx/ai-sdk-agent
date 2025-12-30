import { z } from "zod";

/**
 * LLM Provider types
 */
export const llmProviderSchema = z.enum(["openai-compatible", "google", "openai"]);
export type LLMProvider = z.infer<typeof llmProviderSchema>;

export const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // LLM Provider Configuration
	LLM_PROVIDER: llmProviderSchema.default("openai-compatible"),

  // OpenAI-Compatible Provider (OpenRouter, local LLM, etc.)
  LLM_BASE_URL: z.string().url().optional(),
  LLM_MODEL: z.string().default("qwen/qwen3-30b-a3b:free"),
  LLM_API_KEY: z.string().optional(),

  // Gemini Provider
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),

  // OpenAI Provider
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_API_KEY: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
		const errors = result.error.issues
			.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
			.join("\n");

		throw new Error(`Invalid environment variables:\n${errors}`);
	}

	return result.data;
}

declare module "fastify" {
  interface FastifyInstance {
    config: EnvConfig;
  }
}
