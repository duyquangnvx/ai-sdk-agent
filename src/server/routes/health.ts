import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

const healthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string(),
});

const healthRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get("/health", {
    schema: {
      response: {
        200: healthResponseSchema,
      },
    },
    handler: async () => {
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
      };
    },
  });
};

export default healthRoutes;
