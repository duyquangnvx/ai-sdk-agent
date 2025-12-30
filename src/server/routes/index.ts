import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import healthRoutes from "./health.js";
import gameRoutes from "./game/index.js";

const routes: FastifyPluginAsyncZod = async (fastify) => {
  await fastify.register(healthRoutes);
  await fastify.register(gameRoutes);
};

export default routes;
