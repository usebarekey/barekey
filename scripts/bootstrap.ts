#!/usr/bin/env bun

import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { createClerkClient } from "@clerk/backend";

import {
  buildSeedEntries,
  parseBarekeyScope,
  parseConvexJson,
  parseKeyValueLines,
  privateSeedVariableNames,
  publicSeedVariableNames,
  renderApiProxyConfigModule,
  renderAuthRuntimeConfigModule,
  renderConvexPrivateConfigModule,
  renderUiRuntimeConfigModule,
  toApiProxyRuntimeValues,
  toConvexPrivateRuntimeValues,
  toPublicRuntimeValues,
  type BarekeyScope,
} from "./bootstrap-lib";

type ConvexProjectRow = {
  _id: string;
  orgId: string;
  orgSlug: string;
  slug: string;
};

type VariableRow = {
  id: string;
  visibility: "private" | "public";
  name: string;
};

type DecryptedSecretRow = {
  kind: "secret";
  name: string;
  value: string;
};

type PrepareWriteResult = {
  creates: Array<Record<string, unknown>>;
  updates: Array<Record<string, unknown>>;
  deletes: Array<string>;
};

const repoRoot = path.resolve(import.meta.dir, "..");
const barekeyConfigPath = path.join(repoRoot, "barekey.json");
const rootEnvPath = path.join(repoRoot, ".env");

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function readProcessEnv(key: string): string | undefined {
  const value = process.env[key];
  return typeof value === "string" ? value : undefined;
}

function runCommand(args: Array<string>): string {
  const result = Bun.spawnSync({
    cmd: args,
    cwd: repoRoot,
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = decode(result.stdout).trim();
  const stderr = decode(result.stderr).trim();
  if (result.exitCode !== 0) {
    throw new Error(stderr.length > 0 ? stderr : stdout || `Command failed: ${args.join(" ")}`);
  }

  return stdout;
}

function runConvexProdJson<T>(functionName: string, payload: Record<string, unknown>): T {
  const output = runCommand([
    "bunx",
    "convex",
    "run",
    "--prod",
    functionName,
    JSON.stringify(payload),
  ]);
  return parseConvexJson<T>(output);
}

function listConvexEnv(options?: { prod?: boolean }): Record<string, string> {
  const output = runCommand([
    "bunx",
    "convex",
    "env",
    "list",
    ...(options?.prod ? ["--prod"] : []),
  ]);
  return parseKeyValueLines(output);
}

function listProdProjects(): Array<ConvexProjectRow> {
  const output = runCommand(["bunx", "convex", "data", "projects", "--prod", "--format", "json"]);
  return parseConvexJson<Array<ConvexProjectRow>>(output);
}

async function readBarekeyScope(): Promise<BarekeyScope> {
  return parseBarekeyScope(await readFile(barekeyConfigPath, "utf8"));
}

async function readRootEnvIfPresent(): Promise<Record<string, string>> {
  try {
    return parseKeyValueLines(await readFile(rootEnvPath, "utf8"));
  } catch {
    return {};
  }
}

function ensureProdMasterKey(prodEnv: Record<string, string>): void {
  if (prodEnv.BAREKEY_MASTER_KEY_B64) {
    return;
  }

  const devEnv = listConvexEnv();
  const fallback = devEnv.BAREKEY_MASTER_KEY_B64 ?? readProcessEnv("BAREKEY_MASTER_KEY_B64");
  if (!fallback) {
    throw new Error(
      "BAREKEY_MASTER_KEY_B64 is missing in prod and could not be recovered from dev.",
    );
  }

  runCommand(["bunx", "convex", "env", "set", "--prod", "BAREKEY_MASTER_KEY_B64", fallback]);
}

async function resolveClerkBootstrapContext(input: {
  orgSlug: string;
  secretKey: string;
}): Promise<{ orgId: string; clerkUserId: string }> {
  const clerk = createClerkClient({
    secretKey: input.secretKey,
  });
  const organization = await clerk.organizations.getOrganization({
    slug: input.orgSlug,
  });
  const memberships = await clerk.organizations.getOrganizationMembershipList({
    organizationId: organization.id,
    limit: 1,
  });
  const firstMembership = memberships.data[0] as
    | { publicUserData?: { userId?: string } }
    | undefined;
  const clerkUserId = firstMembership?.publicUserData?.userId;
  if (!clerkUserId) {
    throw new Error(`No Clerk membership found for organization ${input.orgSlug}.`);
  }

  return {
    orgId: organization.id,
    clerkUserId,
  };
}

function resolveProject(scope: BarekeyScope): ConvexProjectRow {
  const project = listProdProjects().find(
    (row) => row.orgSlug === scope.organization && row.slug === scope.project,
  );
  if (!project) {
    throw new Error(
      `Could not find the Barekey config project ${scope.organization}/${scope.project} on prod.`,
    );
  }
  return project;
}

function findProject(scope: BarekeyScope): ConvexProjectRow | null {
  return (
    listProdProjects().find(
      (row) => row.orgSlug === scope.organization && row.slug === scope.project,
    ) ?? null
  );
}

function resolveVariableRows(
  scope: BarekeyScope,
  orgId: string,
  names: Array<string>,
): Array<VariableRow> {
  return runConvexProdJson<Array<VariableRow>>(
    "internal.project_variables.resolveVariableRowsForOrgProjectStageInternal",
    {
      orgId,
      projectSlug: scope.project,
      stageSlug: scope.environment,
      names,
    },
  );
}

function decryptVariable(
  scope: BarekeyScope,
  orgId: string,
  variableId: string,
): DecryptedSecretRow {
  return runConvexProdJson<DecryptedSecretRow>(
    "internal.project_variables.decryptValueForOrgProjectStageInternal",
    {
      orgId,
      projectSlug: scope.project,
      stageSlug: scope.environment,
      variableId,
    },
  );
}

function readVariablesFromBarekey(
  scope: BarekeyScope,
  names: Array<string>,
): Record<string, string> {
  const project = resolveProject(scope);
  const rows = resolveVariableRows(scope, project.orgId, names);
  const rowsByName = new Map(rows.map((row) => [row.name, row]));
  const missing = names.filter((name) => !rowsByName.has(name));
  if (missing.length > 0) {
    throw new Error(`Missing Barekey bootstrap variables: ${missing.join(", ")}`);
  }

  const values: Record<string, string> = {};
  for (const name of names) {
    const row = rowsByName.get(name);
    if (!row) {
      continue;
    }
    const decrypted = decryptVariable(scope, project.orgId, row.id);
    if (decrypted.kind !== "secret") {
      throw new Error(`Expected ${name} to be a secret variable.`);
    }
    values[name] = decrypted.value;
  }

  return values;
}

async function writeGeneratedFile(filePath: string, contents: string): Promise<void> {
  await mkdir(path.dirname(filePath), {
    recursive: true,
  });
  await writeFile(filePath, contents, "utf8");
}

async function syncTargets(target: "all" | "ui" | "auth" | "convex" | "api-proxy"): Promise<void> {
  const scope = await readBarekeyScope();
  const project = findProject(scope);
  const fallbackValues = {
    ...(await readRootEnvIfPresent()),
    ...listConvexEnv({
      prod: true,
    }),
  };
  const sourceValues =
    project === null
      ? fallbackValues
      : {
          ...readVariablesFromBarekey(scope, [...publicSeedVariableNames]),
          ...readVariablesFromBarekey(scope, [...privateSeedVariableNames]),
        };

  if (target === "all" || target === "ui") {
    await writeGeneratedFile(
      path.join(repoRoot, "pkg/ui/src/generated/runtime-config.generated.ts"),
      renderUiRuntimeConfigModule(toPublicRuntimeValues(sourceValues)),
    );
  }

  if (target === "all" || target === "auth") {
    await writeGeneratedFile(
      path.join(repoRoot, "pkg/auth/src/generated/runtime-config.generated.ts"),
      renderAuthRuntimeConfigModule(toPublicRuntimeValues(sourceValues)),
    );
  }

  if (target === "all" || target === "convex") {
    await writeGeneratedFile(
      path.join(repoRoot, "pkg/convex/generated/private_config.generated.ts"),
      renderConvexPrivateConfigModule(toConvexPrivateRuntimeValues(sourceValues)),
    );
  }

  if (target === "all" || target === "api-proxy") {
    await writeGeneratedFile(
      path.join(repoRoot, "pkg/api-proxy/src/generated/private-config.generated.ts"),
      renderApiProxyConfigModule(toApiProxyRuntimeValues(sourceValues)),
    );
  }
}

async function seedProd(): Promise<void> {
  const scope = await readBarekeyScope();
  const prodEnv = listConvexEnv({
    prod: true,
  });
  ensureProdMasterKey(prodEnv);

  const rootEnv = await readRootEnvIfPresent();
  const overriddenConvexUrl = readProcessEnv("BAREKEY_PROD_CONVEX_URL")?.trim();
  const overriddenConvexSiteUrl = readProcessEnv("BAREKEY_PROD_CONVEX_SITE_URL")?.trim();
  const source = {
    ...rootEnv,
    ...prodEnv,
    ...(overriddenConvexUrl ? { VITE_CONVEX_URL: overriddenConvexUrl } : {}),
    ...(overriddenConvexSiteUrl
      ? {
          CONVEX_HTTP_ORIGIN: overriddenConvexSiteUrl,
          VITE_CONVEX_SITE_URL: overriddenConvexSiteUrl,
        }
      : {}),
  };
  const clerkSecretKey = source.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    throw new Error("CLERK_SECRET_KEY is required to bootstrap the Barekey config project.");
  }

  const clerkContext = await resolveClerkBootstrapContext({
    orgSlug: scope.organization,
    secretKey: clerkSecretKey,
  });

  runConvexProdJson("internal.bootstrap.ensureConfigProjectForOrgInternal", {
    orgId: clerkContext.orgId,
    orgSlug: scope.organization,
    clerkUserId: clerkContext.clerkUserId,
    projectSlug: scope.project,
    projectName: "Barekey",
  });

  const entries = buildSeedEntries(source).map((entry) => ({
    name: entry.name,
    visibility: entry.visibility,
    kind: "secret",
    declaredType: entry.declaredType,
    value: entry.value,
  }));

  const prepared = runConvexProdJson<PrepareWriteResult>(
    "internal.project_variables.prepareVariableWritesForOrgProjectStageInternal",
    {
      orgId: clerkContext.orgId,
      clerkUserId: clerkContext.clerkUserId,
      projectSlug: scope.project,
      stageSlug: scope.environment,
      mode: "upsert",
      entries,
      deletes: [],
    },
  );

  runConvexProdJson(
    "internal.project_variables.applyPreparedVariableWritesForOrgProjectStageInternal",
    {
      orgId: clerkContext.orgId,
      clerkUserId: clerkContext.clerkUserId,
      projectSlug: scope.project,
      stageSlug: scope.environment,
      creates: prepared.creates,
      updates: prepared.updates,
      deletes: prepared.deletes,
    },
  );

  await syncTargets("all");
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const target = process.argv[3] as "all" | "ui" | "auth" | "convex" | "api-proxy" | undefined;

  if (command === "seed-prod") {
    await seedProd();
    return;
  }

  if (command === "sync") {
    await syncTargets(target ?? "all");
    return;
  }

  throw new Error(
    "Usage: bun scripts/bootstrap.ts <seed-prod|sync> [all|ui|auth|convex|api-proxy]",
  );
}

await main();
