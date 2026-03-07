import { writeFile } from "node:fs/promises";

import { cancel, confirm, isCancel } from "@clack/prompts";
import { BarekeyClient } from "@barekey/sdk";
import { Command } from "commander";
import pc from "picocolors";

import { createCliAuthProvider } from "../auth-provider";
import {
  addTargetOptions,
  dotenvEscape,
  parseChance,
  requireLocalSession,
  resolveTarget,
  toJsonOutput,
  type EnvTargetOptions,
} from "../command-utils";
import { postJson } from "../http";

async function runEnvGet(
  name: string,
  options: EnvTargetOptions & {
    seed?: string;
    key?: string;
    json?: boolean;
  },
): Promise<void> {
  const local = await requireLocalSession();
  const target = await resolveTarget(options, local);
  const authProvider = createCliAuthProvider();
  const client = new BarekeyClient({
    baseUrl: local.baseUrl,
    auth: authProvider,
    projectSlug: target.projectSlug,
    stageSlug: target.stageSlug,
    orgSlug: target.orgSlug,
  });

  const resolved = await client
    .get(name, {
      seed: options.seed,
      key: options.key,
    })
    .raw();

  if (options.json) {
    toJsonOutput(true, resolved);
    return;
  }

  console.log(resolved.value);
}

async function runEnvGetMany(
  options: EnvTargetOptions & {
    names: string;
    seed?: string;
    key?: string;
    json?: boolean;
  },
): Promise<void> {
  const local = await requireLocalSession();
  const target = await resolveTarget(options, local);
  const authProvider = createCliAuthProvider();
  const client = new BarekeyClient({
    baseUrl: local.baseUrl,
    auth: authProvider,
    projectSlug: target.projectSlug,
    stageSlug: target.stageSlug,
    orgSlug: target.orgSlug,
  });

  const names = options.names
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const resolved = await client.getMany(names, {
    seed: options.seed,
    key: options.key,
  });

  if (options.json) {
    toJsonOutput(true, resolved);
    return;
  }

  for (const key of Object.keys(resolved).sort((left, right) => left.localeCompare(right))) {
    const value = resolved[key];
    if (value) {
      console.log(`${key}=${value.value}`);
    }
  }
}

async function runEnvList(options: EnvTargetOptions & { json?: boolean }): Promise<void> {
  const local = await requireLocalSession();
  const target = await resolveTarget(options, local);
  const authProvider = createCliAuthProvider();
  const accessToken = await authProvider.getAccessToken();

  const response = await postJson<{
    variables: Array<{
      name: string;
      kind: "secret" | "ab_roll";
      declaredType: "string" | "boolean" | "int64" | "float" | "date" | "json";
      createdAtMs: number;
      updatedAtMs: number;
      chance: number | null;
    }>;
  }>({
    baseUrl: local.baseUrl,
    path: "/v1/env/list",
    accessToken,
    payload: {
      orgSlug: target.orgSlug,
      projectSlug: target.projectSlug,
      stageSlug: target.stageSlug,
    },
  });

  if (options.json) {
    toJsonOutput(true, response.variables);
    return;
  }

  if (response.variables.length === 0) {
    console.log("No variables found.");
    return;
  }

  for (const row of response.variables) {
    const chanceSuffix = row.kind === "ab_roll" ? ` chance=${row.chance ?? 0}` : "";
    console.log(`${row.name}  ${pc.dim(row.kind)}  ${pc.dim(row.declaredType)}${chanceSuffix}`);
  }
}

async function runEnvWrite(
  operation: "create_only" | "upsert",
  name: string,
  value: string,
  options: EnvTargetOptions & {
    ab?: string;
    chance?: string;
    type?: "string" | "boolean" | "int64" | "float" | "date" | "json";
    json?: boolean;
  },
): Promise<void> {
  const local = await requireLocalSession();
  const target = await resolveTarget(options, local);
  const authProvider = createCliAuthProvider();
  const accessToken = await authProvider.getAccessToken();

  const entry =
    options.ab !== undefined
      ? {
          name,
          kind: "ab_roll" as const,
          declaredType: options.type ?? "string",
          valueA: value,
          valueB: options.ab,
          chance: parseChance(options.chance),
        }
      : {
          name,
          kind: "secret" as const,
          declaredType: options.type ?? "string",
          value,
        };

  const result = await postJson<{
    createdCount: number;
    updatedCount: number;
    deletedCount: number;
  }>({
    baseUrl: local.baseUrl,
    path: "/v1/env/write",
    accessToken,
    payload: {
      orgSlug: target.orgSlug,
      projectSlug: target.projectSlug,
      stageSlug: target.stageSlug,
      mode: operation,
      entries: [entry],
      deletes: [],
    },
  });

  if (options.json) {
    toJsonOutput(true, result);
    return;
  }

  console.log(
    `Created: ${result.createdCount}, Updated: ${result.updatedCount}, Deleted: ${result.deletedCount}`,
  );
}

async function runEnvDelete(
  name: string,
  options: EnvTargetOptions & {
    yes?: boolean;
    ignoreMissing?: boolean;
    json?: boolean;
  },
): Promise<void> {
  const local = await requireLocalSession();
  const target = await resolveTarget(options, local);
  const authProvider = createCliAuthProvider();
  const accessToken = await authProvider.getAccessToken();

  if (!options.ignoreMissing) {
    const listed = await postJson<{
      variables: Array<{
        name: string;
      }>;
    }>({
      baseUrl: local.baseUrl,
      path: "/v1/env/list",
      accessToken,
      payload: {
        orgSlug: target.orgSlug,
        projectSlug: target.projectSlug,
        stageSlug: target.stageSlug,
      },
    });
    const exists = listed.variables.some((row) => row.name === name);
    if (!exists) {
      throw new Error(`Variable ${name} was not found in this stage.`);
    }
  }

  if (!options.yes) {
    if (!process.stdout.isTTY) {
      throw new Error("Deletion requires --yes in non-interactive mode.");
    }
    const confirmed = await confirm({
      message: `Delete variable ${name}?`,
      initialValue: false,
    });
    if (isCancel(confirmed)) {
      cancel("Delete canceled.");
      return;
    }
    if (!confirmed) {
      throw new Error("Delete canceled.");
    }
  }

  const result = await postJson<{
    createdCount: number;
    updatedCount: number;
    deletedCount: number;
  }>({
    baseUrl: local.baseUrl,
    path: "/v1/env/write",
    accessToken,
    payload: {
      orgSlug: target.orgSlug,
      projectSlug: target.projectSlug,
      stageSlug: target.stageSlug,
      mode: "upsert",
      entries: [],
      deletes: [name],
    },
  });

  if (options.json) {
    toJsonOutput(true, result);
    return;
  }

  console.log(`Deleted: ${result.deletedCount}`);
}

async function runEnvPull(
  options: EnvTargetOptions & {
    format?: "dotenv" | "json";
    out?: string;
    seed?: string;
    key?: string;
    redact?: boolean;
  },
): Promise<void> {
  const local = await requireLocalSession();
  const target = await resolveTarget(options, local);
  const authProvider = createCliAuthProvider();
  const accessToken = await authProvider.getAccessToken();

  const response = await postJson<{
    values: Array<{
      name: string;
      kind: "secret" | "ab_roll";
      declaredType: "string" | "boolean" | "int64" | "float" | "date" | "json";
      value: string;
    }>;
    byName: Record<string, string>;
  }>({
    baseUrl: local.baseUrl,
    path: "/v1/env/pull",
    accessToken,
    payload: {
      orgSlug: target.orgSlug,
      projectSlug: target.projectSlug,
      stageSlug: target.stageSlug,
      seed: options.seed,
      key: options.key,
    },
  });

  const format = options.format ?? "dotenv";
  const sortedKeys = Object.keys(response.byName).sort((left, right) => left.localeCompare(right));
  const output =
    format === "json"
      ? `${JSON.stringify(response.byName, null, 2)}\n`
      : `${sortedKeys.map((keyName) => `${keyName}=${dotenvEscape(response.byName[keyName] ?? "")}`).join("\n")}\n`;

  if (options.out) {
    await writeFile(options.out, output, "utf8");
    console.log(`Wrote ${options.out}`);
    return;
  }

  if (options.redact && !process.stdout.isTTY) {
    console.log(`Pulled ${response.values.length} variables.`);
    return;
  }

  process.stdout.write(output);
}

export function registerEnvCommands(program: Command): void {
  const env = program.command("env").description("Environment variable operations");

  addTargetOptions(
    env
      .command("get")
      .description("Evaluate one variable")
      .argument("<name>", "Variable name")
      .option("--seed <value>", "Deterministic seed")
      .option("--key <value>", "Deterministic key")
      .option("--json", "Machine-readable output", false),
  ).action(
    async (
      name: string,
      options: EnvTargetOptions & { seed?: string; key?: string; json?: boolean },
    ) => {
      await runEnvGet(name, options);
    },
  );

  addTargetOptions(
    env
      .command("get-many")
      .description("Evaluate a batch of variables")
      .requiredOption("--names <csv>", "Comma-separated variable names")
      .option("--seed <value>", "Deterministic seed")
      .option("--key <value>", "Deterministic key")
      .option("--json", "Machine-readable output", false),
  ).action(
    async (
      options: EnvTargetOptions & {
        names: string;
        seed?: string;
        key?: string;
        json?: boolean;
      },
    ) => {
      await runEnvGetMany(options);
    },
  );

  addTargetOptions(
    env
      .command("list")
      .description("List variables for a project stage")
      .option("--json", "Machine-readable output", false),
  ).action(async (options: EnvTargetOptions & { json?: boolean }) => {
    await runEnvList(options);
  });

  addTargetOptions(
    env
      .command("new")
      .description("Create one variable")
      .argument("<name>", "Variable name")
      .argument("<value>", "Variable value")
      .option("--ab <value-b>", "Second value for ab_roll")
      .option("--chance <number>", "A-branch probability between 0 and 1")
      .option("--type <type>", "Declared value type", "string")
      .option("--json", "Machine-readable output", false),
  ).action(
    async (
      name: string,
      value: string,
      options: EnvTargetOptions & {
        ab?: string;
        chance?: string;
        type?: "string" | "boolean" | "int64" | "float" | "date" | "json";
        json?: boolean;
      },
    ) => {
      await runEnvWrite("create_only", name, value, options);
    },
  );

  addTargetOptions(
    env
      .command("set")
      .description("Upsert one variable")
      .argument("<name>", "Variable name")
      .argument("<value>", "Variable value")
      .option("--ab <value-b>", "Second value for ab_roll")
      .option("--chance <number>", "A-branch probability between 0 and 1")
      .option("--type <type>", "Declared value type", "string")
      .option("--json", "Machine-readable output", false),
  ).action(
    async (
      name: string,
      value: string,
      options: EnvTargetOptions & {
        ab?: string;
        chance?: string;
        type?: "string" | "boolean" | "int64" | "float" | "date" | "json";
        json?: boolean;
      },
    ) => {
      await runEnvWrite("upsert", name, value, options);
    },
  );

  addTargetOptions(
    env
      .command("delete")
      .description("Delete one variable")
      .argument("<name>", "Variable name")
      .option("--yes", "Skip confirmation", false)
      .option("--ignore-missing", "Do not fail when variable is missing", false)
      .option("--json", "Machine-readable output", false),
  ).action(
    async (
      name: string,
      options: EnvTargetOptions & { yes?: boolean; ignoreMissing?: boolean; json?: boolean },
    ) => {
      await runEnvDelete(name, options);
    },
  );

  addTargetOptions(
    env
      .command("pull")
      .description("Pull resolved variables for a project stage")
      .option("--format <type>", "Output format: dotenv|json", "dotenv")
      .option("--out <path>", "Output file path")
      .option("--seed <value>", "Deterministic seed")
      .option("--key <value>", "Deterministic key")
      .option("--redact", "Print only summary in non-file mode", false),
  ).action(
    async (
      options: EnvTargetOptions & {
        format?: "dotenv" | "json";
        out?: string;
        seed?: string;
        key?: string;
        redact?: boolean;
      },
    ) => {
      await runEnvPull(options);
    },
  );
}
