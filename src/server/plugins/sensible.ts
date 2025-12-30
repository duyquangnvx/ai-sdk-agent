import sensible from "@fastify/sensible";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

async function sensiblePlugin(fastify: FastifyInstance) {
  await fastify.register(sensible);
}

export default fp(sensiblePlugin, {
  name: "sensible",
});
