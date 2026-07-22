import { describe, expect, it } from "vitest";

import { createApplication } from "../../src/app/composition-root/application.js";
import { loadConfig } from "../../src/infrastructure/config/config.js";

describe("composition-root shutdown", () => {
  it("closes the server and resources once without waiting", async () => {
    const config = loadConfig({
      GALAXIS_PORT: "3000",
      GALAXIS_LOG_LEVEL: "silent",
      GALAXIS_SHUTDOWN_TIMEOUT_MS: "10",
    });
    let closeCalls = 0;
    const application = createApplication(config, {
      resources: [
        {
          close: async () => {
            closeCalls += 1;
          },
        },
      ],
    });

    await application.server.ready();
    await application.shutdown("test");
    await application.shutdown("test-again");

    expect(closeCalls).toBe(1);
  });
});
