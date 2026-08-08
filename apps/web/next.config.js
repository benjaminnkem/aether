import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const result = config({
  path: resolve(workspaceRoot, ".env"),
  override: false,
  quiet: true,
});
if (result.error && result.error.code !== "ENOENT") {
  throw new Error("Unable to load the repository-root .env for Next.js.", {
    cause: result.error,
  });
}

const apiUrl = requiredPublicUrl("NEXT_PUBLIC_AETHER_API_URL");
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_AETHER_API_URL: apiUrl,
    NEXT_PUBLIC_AETHER_APP_URL: requiredPublicUrl("NEXT_PUBLIC_AETHER_APP_URL"),
    NEXT_PUBLIC_AETHER_EXPLORER_URL: requiredPublicUrl(
      "NEXT_PUBLIC_AETHER_EXPLORER_URL",
    ),
  },
};

export default nextConfig;

function requiredPublicUrl(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required by the frontend build.`);
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${name} must use http or https.`);
  }
  return value.replace(/\/$/, "");
}
