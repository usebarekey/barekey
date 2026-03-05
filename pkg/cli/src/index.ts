#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";

import { registerAuthCommands } from "./commands/auth";
import { registerEnvCommands } from "./commands/env";
import { registerTypegenCommand } from "./commands/typegen";
import { CLI_DESCRIPTION, CLI_NAME, CLI_VERSION } from "./constants";

const program = new Command();
program.name(CLI_NAME).description(CLI_DESCRIPTION).version(CLI_VERSION);

registerAuthCommands(program);
registerEnvCommands(program);
registerTypegenCommand(program);

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Command failed.";
  console.error(pc.red(message));
  process.exitCode = 1;
});
