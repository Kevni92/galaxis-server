import { ConfigurationError, loadConfig } from "../../infrastructure/config/config.js";
import { createApplication } from "./application.js";

export async function run(): Promise<void> {
  let application: ReturnType<typeof createApplication>;

  try {
    application = createApplication(loadConfig());
  } catch (error) {
    const message =
      error instanceof ConfigurationError ? error.message : "Unable to configure server";
    console.error(message);
    process.exitCode = 1;
    return;
  }

  const handleSignal = (signal: NodeJS.Signals): void => {
    void application.shutdown(signal).catch((error: unknown) => {
      application.logger.error({ component: "lifecycle", err: error }, "server shutdown failed");
      process.exitCode = 1;
    });
  };

  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);

  try {
    await application.start();
  } catch (error) {
    application.logger.error({ component: "lifecycle", err: error }, "server start failed");
    await application.shutdown("startup-failure").catch(() => undefined);
    process.exitCode = 1;
  }
}

await run();
