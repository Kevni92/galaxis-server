import Fastify, { type FastifyInstance } from "fastify";

/** Creates the empty transport shell used by the repository smoke test. */
export function createServer(): FastifyInstance {
  return Fastify({ logger: true });
}
