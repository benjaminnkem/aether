import { existsSync } from "node:fs";
import { dirname, join, parse, resolve } from "node:path";
import { config } from "dotenv";

export interface RootEnvironmentOptions {
  environment?: NodeJS.ProcessEnv;
  startDirectories?: string[];
}

/**
 * Loads the repository-root `.env` without replacing variables injected by the
 * shell, CI, or a hosted secret manager. Runtime packages are launched by Turbo
 * from their package directories, so relying on the current directory alone is
 * insufficient.
 */
export function loadRootEnvironment(
  options: RootEnvironmentOptions = {},
): string | null {
  const environment = options.environment ?? process.env;
  const startDirectories = options.startDirectories ?? [
    process.cwd(),
    __dirname,
  ];
  const workspaceRoot = startDirectories
    .map(findWorkspaceRoot)
    .find((candidate): candidate is string => candidate !== null);

  if (!workspaceRoot) return null;

  const envPath = join(workspaceRoot, ".env");
  if (!existsSync(envPath)) return null;

  const result = config({
    path: envPath,
    override: false,
    processEnv: environment,
    quiet: true,
  });
  if (result.error) {
    throw new Error(
      `Unable to load the repository environment file: ${envPath}`,
      {
        cause: result.error,
      },
    );
  }
  return envPath;
}

function findWorkspaceRoot(startDirectory: string): string | null {
  let current = resolve(startDirectory);
  const filesystemRoot = parse(current).root;

  while (true) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) return current;
    if (current === filesystemRoot) return null;
    current = dirname(current);
  }
}
