/**
 * Architekturregeln für GAL-PLATFORM-STACK-001.
 * Die Ausführung erfolgt nach Installation von dependency-cruiser über pnpm.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-does-not-import-technical-adapters",
      severity: "error",
      from: { path: "^src/domain" },
      to: {
        path: "^src/(application|infrastructure|transport|app)",
      },
    },
    {
      name: "domain-does-not-import-technical-packages",
      severity: "error",
      from: { path: "^src/domain" },
      to: {
        pathNot: "^src/domain",
        path: "(^|/)(fastify|@fastify/|@sinclair/typebox|kysely|pg|node:)",
      },
    },
    {
      name: "application-does-not-import-transport",
      severity: "error",
      from: { path: "^src/application" },
      to: { path: "^src/transport" },
    },
    {
      name: "application-does-not-import-infrastructure",
      severity: "error",
      from: { path: "^src/application" },
      to: { path: "^src/infrastructure" },
    },
    {
      name: "transport-does-not-import-infrastructure",
      severity: "error",
      from: { path: "^src/transport" },
      to: { path: "^src/infrastructure" },
    },
  ],
  options: {
    doNotFollow: {
      path: "(^|/)(node_modules|dist|coverage)/",
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
    exclude: "(^|/)(README\\.md|.*\\.test\\.ts)$",
    moduleSystems: ["es6", "cjs"],
    preserveSymlinks: false,
    prefix: "",
  },
};
