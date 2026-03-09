import { writeTypegenFile } from "../typegen.js";
import { createCliAuthProvider } from "../auth-provider.js";
import {
  addTargetOptions,
  requireLocalSession,
  resolveTarget,
  type EnvTargetOptions,
} from "../command-utils.js";
import { getJson } from "../http.js";
import { Command } from "commander";

async function runTypegen(options: EnvTargetOptions & { out: string }): Promise<void> {
  const local = await requireLocalSession();
  const target = await resolveTarget(options, local);
  const authProvider = createCliAuthProvider();
  const accessToken = await authProvider.getAccessToken();
  const manifest = await getJson<{
    orgId: string;
    orgSlug: string;
    projectSlug: string;
    stageSlug: string;
    generatedAtMs: number;
    manifestVersion: string;
      variables: Array<{
        name: string;
        kind: "secret" | "ab_roll" | "rollout";
        declaredType: "string" | "boolean" | "int64" | "float" | "date" | "json";
        required: boolean;
        updatedAtMs: number;
        typeScriptType: string;
      }>;
  }>({
    baseUrl: local.baseUrl,
    path: `/v1/typegen/manifest?projectSlug=${encodeURIComponent(target.projectSlug)}&stageSlug=${encodeURIComponent(target.stageSlug)}${target.orgSlug ? `&orgSlug=${encodeURIComponent(target.orgSlug)}` : ""}`,
    accessToken,
  });

  await writeTypegenFile({
    manifest,
    outPath: options.out,
  });

  console.log(`Wrote ${options.out}`);
}

export function registerTypegenCommand(program: Command): void {
  addTargetOptions(
    program
      .command("typegen")
      .description("Generate Barekey key/type map")
      .option("--out <path>", "Output path", "barekey-env.generated.ts"),
  ).action(async (options: EnvTargetOptions & { out: string }) => {
    await runTypegen(options);
  });
}
