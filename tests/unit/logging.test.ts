import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/infrastructure/config/config.js";
import { createLogger } from "../../src/infrastructure/logging/logger.js";

class CaptureStream extends Writable {
  public readonly chunks: string[] = [];

  public override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(chunk.toString());
    callback();
  }
}

describe("structured logging", () => {
  it("includes runtime metadata and redacts sensitive fields", () => {
    const config = loadConfig({ GALAXIS_PORT: "3000", GALAXIS_LOG_LEVEL: "info" });
    const destination = new CaptureStream();
    const logger = createLogger(config, destination);

    logger.info(
      { component: "test", correlationId: "cor_test", token: "do-not-log" },
      "test event",
    );

    const output = destination.chunks.join("");
    expect(output).toContain('"level"');
    expect(output).toContain('"time"');
    expect(output).toContain('"component":"test"');
    expect(output).toContain('"correlationId":"cor_test"');
    expect(output).not.toContain("do-not-log");
  });
});
