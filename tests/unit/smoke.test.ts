import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/infrastructure/config/config.js";
import { createServer } from "../../src/app/composition-root/server.js";

describe("server bootstrap", () => {
  it("creates a Fastify server without registering product routes", async () => {
    const server = createServer(loadConfig({ GALAXIS_PORT: "3000", GALAXIS_LOG_LEVEL: "silent" }));

    try {
      const response = await server.inject({ method: "GET", url: "/" });

      expect(response.statusCode).toBe(404);
    } finally {
      await server.close();
    }
  });
});
