import { BarekeyClient } from "./client";
import { BarekeyError } from "./errors";
import type { BarekeyClientOptions, BarekeyGetOptions, BarekeyResolvedValue } from "./types";
import { BarekeyValueBuilder } from "./value-builder";

let singletonClient: BarekeyClient | null = null;

export function initEnv(options: BarekeyClientOptions): BarekeyClient {
  singletonClient = new BarekeyClient(options);
  return singletonClient;
}

export const env: Pick<BarekeyClient, "get" | "getMany"> = {
  get(name: string, options?: BarekeyGetOptions): BarekeyValueBuilder<string> {
    if (singletonClient === null) {
      throw new BarekeyError({
        code: "INVALID_REQUEST",
        message: "env singleton is not initialized. Call initEnv() first.",
      });
    }
    return singletonClient.get(name, options);
  },
  async getMany(
    names: Array<string>,
    options?: BarekeyGetOptions,
  ): Promise<Record<string, BarekeyResolvedValue>> {
    if (singletonClient === null) {
      throw new BarekeyError({
        code: "INVALID_REQUEST",
        message: "env singleton is not initialized. Call initEnv() first.",
      });
    }
    return singletonClient.getMany(names, options);
  },
};
