import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { loadEnv } from "../config/env.js";
import corsPlugin from "./plugins/cors.js";
import sensiblePlugin from "./plugins/sensible.js";
import gameRpcPlugin from "./plugins/game-rpc.js";
import routes from "./routes/index.js";

export async function buildApp() {
  const config = loadEnv();

  const fastify = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport:
        config.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
              },
            }
          : undefined,
    },
  }).withTypeProvider<ZodTypeProvider>();

  // Set up Zod validation
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  // Decorate with config
  fastify.decorate("config", config);

  // Register plugins
  await fastify.register(corsPlugin);
  await fastify.register(sensiblePlugin);
  await fastify.register(gameRpcPlugin);

  // Register routes
  await fastify.register(routes);

  return fastify;
}
