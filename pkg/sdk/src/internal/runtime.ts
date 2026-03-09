import {
  FsNotAvailableError,
  InvalidConfigurationProvidedError,
  InvalidCredentialsProvidedError,
  InvalidRefreshTokenError,
  NoConfigurationProvidedError,
  NoCredentialsProvidedError,
  UnauthorizedError,
} from "../errors.js";
import type { BarekeyClientOptions, BarekeyJsonConfig, BarekeyStandardSchemaV1 } from "../types.js";
import { type InternalAuthResolver, normalizeBaseUrl } from "./http.js";
import {
  isFilesystemAvailable,
  loadBarekeyJsonConfig,
  loadCliSessionAuthResolver,
} from "./node-runtime.js";

const DEFAULT_BAREKEY_API_URL = "https://api.barekey.dev";

type BarekeyResolvedScope = {
  organization: string;
  project: string;
  environment: string;
};

export type BarekeyRuntimeContext = BarekeyResolvedScope & {
  baseUrl: string;
  auth: InternalAuthResolver;
  requirements?: BarekeyStandardSchemaV1;
};

function readProcessEnv(key: string): string | undefined {
  if (typeof process === "undefined" || typeof process.env !== "object" || process.env === null) {
    return undefined;
  }

  const value = process.env[key];
  return typeof value === "string" ? value : undefined;
}

function normalizeScope(input: {
  organization?: string;
  project?: string;
  environment?: string;
  source: string;
}): BarekeyResolvedScope {
  const organization = input.organization?.trim() ?? "";
  const project = input.project?.trim() ?? "";
  const environment = input.environment?.trim() ?? "";
  if (organization.length === 0 || project.length === 0 || environment.length === 0) {
    throw new InvalidConfigurationProvidedError({
      message: `${input.source} must provide organization, project, and environment.`,
    });
  }

  return {
    organization,
    project,
    environment,
  };
}

function normalizeJsonConfig(input: BarekeyJsonConfig, source: string): BarekeyResolvedScope {
  return normalizeScope({
    organization: input.organization ?? input.org,
    project: input.project,
    environment: input.environment ?? input.stage,
    source,
  });
}

async function resolveScope(options: BarekeyClientOptions): Promise<BarekeyResolvedScope> {
  const explicitOrganization = "organization" in options ? options.organization : undefined;
  const explicitProject = "project" in options ? options.project : undefined;
  const explicitEnvironment = "environment" in options ? options.environment : undefined;
  const explicitJson = "json" in options ? options.json : undefined;

  const explicitCount =
    Number(explicitOrganization !== undefined) +
    Number(explicitProject !== undefined) +
    Number(explicitEnvironment !== undefined);

  if (explicitJson !== undefined && explicitCount > 0) {
    throw new InvalidConfigurationProvidedError({
      message: "Pass either json or organization/project/environment, not both.",
    });
  }

  if (explicitCount > 0 && explicitCount < 3) {
    throw new InvalidConfigurationProvidedError({
      message: "organization, project, and environment must be provided together.",
    });
  }

  if (explicitJson !== undefined) {
    return normalizeJsonConfig(explicitJson, "The provided json configuration");
  }

  if (explicitCount === 3) {
    return normalizeScope({
      organization: explicitOrganization,
      project: explicitProject,
      environment: explicitEnvironment,
      source: "The provided Barekey configuration",
    });
  }

  const loadedConfig = await loadBarekeyJsonConfig();
  if (loadedConfig === null) {
    if (!(await isFilesystemAvailable())) {
      throw new FsNotAvailableError();
    }
    throw new NoConfigurationProvidedError({
      message: "No Barekey configuration was found and no barekey.json file could be loaded.",
    });
  }

  return normalizeJsonConfig(
    loadedConfig.json as BarekeyJsonConfig,
    `The barekey.json file at ${loadedConfig.path}`,
  );
}

async function resolveAuth(fetchFn: typeof globalThis.fetch): Promise<{
  baseUrl: string;
  auth: InternalAuthResolver;
}> {
  const envToken = readProcessEnv("BAREKEY_ACCESS_TOKEN");
  if (envToken !== undefined) {
    const normalizedToken = envToken.trim();
    if (normalizedToken.length === 0) {
      throw new InvalidCredentialsProvidedError({
        message: "BAREKEY_ACCESS_TOKEN was provided but is empty.",
      });
    }

    const envBaseUrl = readProcessEnv("BAREKEY_API_URL")?.trim();
    return {
      baseUrl: normalizeBaseUrl(
        envBaseUrl && envBaseUrl.length > 0 ? envBaseUrl : DEFAULT_BAREKEY_API_URL,
      ),
      auth: {
        async getAccessToken(): Promise<string> {
          return normalizedToken;
        },
      },
    };
  }

  const cliSession = await loadCliSessionAuthResolver(fetchFn);
  if (cliSession === null) {
    if (!(await isFilesystemAvailable())) {
      throw new FsNotAvailableError();
    }
    throw new NoCredentialsProvidedError();
  }

  return {
    baseUrl: normalizeBaseUrl(cliSession.baseUrl),
    auth: {
      async getAccessToken(): Promise<string> {
        try {
          return await cliSession.getAccessToken();
        } catch (error: unknown) {
          if (error instanceof InvalidRefreshTokenError || error instanceof UnauthorizedError) {
            throw new InvalidCredentialsProvidedError({
              message: "Stored Barekey CLI credentials are no longer valid.",
              cause: error,
            });
          }
          throw error;
        }
      },
      async onUnauthorized(): Promise<void> {
        await cliSession.onUnauthorized();
      },
    },
  };
}

export async function resolveRuntimeContext(
  options: BarekeyClientOptions,
  fetchFn: typeof globalThis.fetch,
): Promise<BarekeyRuntimeContext> {
  const [scope, auth] = await Promise.all([resolveScope(options), resolveAuth(fetchFn)]);
  return {
    ...scope,
    baseUrl: auth.baseUrl,
    auth: auth.auth,
    requirements: options.requirements,
  };
}
