import { Autumn } from "autumn-js";

import { runtimeConfig } from "../../runtime/config";

/**
 * Creates the configured Autumn SDK client for billing provider calls.
 *
 * @returns The configured Autumn client.
 * @remarks This reads the runtime secret key but does not perform network I/O by itself.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function createAutumnClient(): Autumn {
  return new Autumn({
    secretKey: runtimeConfig.autumnSecretKey,
  });
}
