import { fileURLToPath } from "node:url";

export const migrationDirectory = fileURLToPath(new URL("../../migrations/", import.meta.url));
