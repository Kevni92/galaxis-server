import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const domainRoot = join(repositoryRoot, "src", "domain");

const forbiddenImportPatterns = [
  /\bfrom\s+["'](?:fastify|@fastify\/|@sinclair\/typebox|kysely|pg|node:)/u,
  /\bimport\s*(?:\(\s*)?["'](?:fastify|@fastify\/|@sinclair\/typebox|kysely|pg|node:)/u,
  /\bprocess\.env\b/u
];

const forbiddenDirectAccessPatterns = [
  /\bDate\.now\s*\(/u,
  /\bnew\s+Date\s*\(/u,
  /\bMath\.random\s*\(/u,
  /\bcrypto\.randomUUID\s*\(/u
];

function sourceFiles(directory) {
  if (!statSync(directory, { throwIfNoEntry: false })) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && /\.tsx?$/u.test(entry.name) ? [path] : [];
  });
}

const violations = [];
for (const file of sourceFiles(domainRoot)) {
  const source = readFileSync(file, "utf8");
  const path = relative(repositoryRoot, file);

  for (const pattern of forbiddenImportPatterns) {
    if (pattern.test(source)) {
      violations.push(`${path}: forbidden technical import or process access (${pattern})`);
    }
  }

  for (const pattern of forbiddenDirectAccessPatterns) {
    if (pattern.test(source)) {
      violations.push(`${path}: forbidden direct time or randomness access (${pattern})`);
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Architecture boundary check passed.");
}
