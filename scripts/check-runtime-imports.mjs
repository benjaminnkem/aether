import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const files = execFileSync("rg", ["--files", "apps", "packages"], {
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .filter(
    (file) =>
      /\/src\/.+\.(?:ts|tsx|js|jsx)$/.test(file) &&
      !/\.test\.|\/__tests__\//.test(file),
  );
const forbidden =
  /@aether\/mock-data|from\s+["'][^"']*(?:\/test\/|\/__tests__\/|\.mock)|\bmsw\b/;
const violations = files.filter((file) =>
  forbidden.test(readFileSync(file, "utf8")),
);
if (violations.length) {
  console.error("Runtime code imports test/mock modules:");
  for (const file of violations) console.error(file);
  process.exit(1);
}
console.log(`runtime-import-check: passed (${files.length} files)`);
