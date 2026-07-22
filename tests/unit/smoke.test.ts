import { describe, expect, it } from "vitest";

import { createServer } from "../../src/app/composition-root/server.js";

describe("server bootstrap", () => {
  it("creates a Fastify server without registering product routes", async () => {
    const server = createServer();

    try {
      const response = await server.inject({ method: "GET", url: "/" });

      expect(response.statusCode).toBe(404);
    } finally {
      await server.close();
    }
  });
});
