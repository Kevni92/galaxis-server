import { describe, expect, it } from "vitest";

import type { ReadinessProbe } from "../../src/application/health/readiness.js";
import { createServer } from "../../src/app/composition-root/server.js";
import { loadConfig } from "../../src/infrastructure/config/config.js";

const config = loadConfig({ GALAXIS_PORT: "3000", GALAXIS_LOG_LEVEL: "silent" });

describe("health endpoints", () => {
  it("reports liveness without checking infrastructure", async () => {
    const readinessProbe: ReadinessProbe = {
      check: async () => {
        throw new Error("readiness must not be called by liveness");
      },
    };
    const server = createServer(config, { readinessProbe });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/health/live",
        headers: { "x-correlation-id": "cor_live" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok", correlationId: "cor_live" });
    } finally {
      await server.close();
    }
  });

  it("returns ready when infrastructure is available", async () => {
    const server = createServer(config, {
      readinessProbe: { check: async () => ({ ready: true }) },
    });

    try {
      const response = await server.inject({ method: "GET", url: "/health/ready" });

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe("ready");
    } finally {
      await server.close();
    }
  });

  it("returns 503 when infrastructure is unavailable", async () => {
    const server = createServer(config, {
      readinessProbe: { check: async () => ({ ready: false }) },
    });

    try {
      const response = await server.inject({ method: "GET", url: "/health/ready" });

      expect(response.statusCode).toBe(503);
      expect(response.json().status).toBe("not_ready");
    } finally {
      await server.close();
    }
  });

  it("returns 503 when the readiness probe fails", async () => {
    const server = createServer(config, {
      readinessProbe: { check: async () => Promise.reject(new Error("database unavailable")) },
    });

    try {
      const response = await server.inject({ method: "GET", url: "/health/ready" });

      expect(response.statusCode).toBe(503);
      expect(response.json().status).toBe("not_ready");
    } finally {
      await server.close();
    }
  });
});
