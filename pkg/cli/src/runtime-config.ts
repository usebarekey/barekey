import { access, readFile } from "node:fs/promises";
import path from "node:path";

export type BarekeyRuntimeConfig = {
  org?: string;
  project?: string;
  environment?: string;
};

export type BarekeyRuntimeConfigResult = {
  config: BarekeyRuntimeConfig;
  path: string;
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findBarekeyConfigPath(startDirectory: string): Promise<string | null> {
  let current = path.resolve(startDirectory);
  while (true) {
    const candidate = path.join(current, "barekey.json");
    if (await fileExists(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export async function loadRuntimeConfig(): Promise<BarekeyRuntimeConfigResult | null> {
  const configPath = await findBarekeyConfigPath(process.cwd());
  if (configPath === null) {
    return null;
  }

  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return {
    path: configPath,
    config: {
      org:
        typeof parsed.organization === "string"
          ? parsed.organization.trim()
          : typeof parsed.org === "string"
            ? parsed.org.trim()
            : undefined,
      project: typeof parsed.project === "string" ? parsed.project.trim() : undefined,
      environment:
        typeof parsed.environment === "string"
          ? parsed.environment.trim()
          : typeof parsed.stage === "string"
            ? parsed.stage.trim()
            : undefined,
    },
  };
}
