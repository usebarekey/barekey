import { NetworkError, VariableNotFoundError } from "./errors.js";
import { BarekeyEnvHandle } from "./handle.js";
import {
  evaluateDefinition,
  inferSelectedArmFromDecision,
  parseDeclaredValue,
  validateDynamicOptions,
} from "./internal/evaluate.js";
import { postJson } from "./internal/http.js";
import { validateRequirements } from "./internal/requirements.js";
import { resolveRuntimeContext, type BarekeyRuntimeContext } from "./internal/runtime.js";
import { MemoryCache } from "./internal/cache.js";
import type {
  BarekeyClientOptions,
  BarekeyEvaluatedValue,
  BarekeyGetOptions,
  BarekeyJsonConfig,
  BarekeyVariableDefinition,
} from "./types.js";

type DefinitionsResponse = {
  definitions: Array<BarekeyVariableDefinition>;
};

type EvaluateResponse = {
  name: string;
  kind: BarekeyEvaluatedValue["kind"];
  declaredType: BarekeyEvaluatedValue["declaredType"];
  value: string;
  decision?: BarekeyEvaluatedValue["decision"];
};

function createDefaultFetch(): typeof globalThis.fetch {
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }

  return (async () => {
    throw new NetworkError({
      message: "fetch is not available in this runtime.",
    });
  }) as typeof globalThis.fetch;
}

export class BarekeyClient {
  private readonly options: BarekeyClientOptions;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly definitionCache = new MemoryCache<BarekeyVariableDefinition>();
  private readonly evaluationCache = new MemoryCache<BarekeyEvaluatedValue>();
  private runtimeContextPromise: Promise<BarekeyRuntimeContext> | null = null;
  private requirementsPromise: Promise<void> | null = null;

  constructor();
  constructor(options: {
    organization: string;
    project: string;
    environment: string;
    requirements?: BarekeyClientOptions["requirements"];
  });
  constructor(options: {
    json: BarekeyJsonConfig;
    requirements?: BarekeyClientOptions["requirements"];
  });
  constructor(options: BarekeyClientOptions = {}) {
    this.options = options;
    this.fetchFn = createDefaultFetch();
  }

  get<TValue = unknown>(name: string, options?: BarekeyGetOptions): BarekeyEnvHandle<TValue> {
    return new BarekeyEnvHandle<TValue>(
      async () => await this.resolveEvaluatedValue(name, options),
    );
  }

  private async getRuntimeContext(): Promise<BarekeyRuntimeContext> {
    if (this.runtimeContextPromise === null) {
      this.runtimeContextPromise = resolveRuntimeContext(this.options, this.fetchFn);
    }
    return await this.runtimeContextPromise;
  }

  private buildDefinitionCacheKey(context: BarekeyRuntimeContext, name: string): string {
    return [context.organization, context.project, context.environment, name].join("|");
  }

  private buildEvaluationCacheKey(
    context: BarekeyRuntimeContext,
    name: string,
    options?: BarekeyGetOptions,
  ): string {
    return [
      context.organization,
      context.project,
      context.environment,
      name,
      options?.seed ?? "",
      options?.key ?? "",
    ].join("|");
  }

  private async fetchDefinitions(names?: Array<string>): Promise<Array<BarekeyVariableDefinition>> {
    const context = await this.getRuntimeContext();
    const response = await postJson<DefinitionsResponse>({
      fetchFn: this.fetchFn,
      baseUrl: context.baseUrl,
      path: "/v1/env/definitions",
      payload: {
        orgSlug: context.organization,
        projectSlug: context.project,
        stageSlug: context.environment,
        ...(names === undefined ? {} : { names }),
      },
      auth: context.auth,
    });

    for (const definition of response.definitions) {
      this.definitionCache.set(this.buildDefinitionCacheKey(context, definition.name), definition);
    }

    return response.definitions;
  }

  private async ensureRequirementsValidated(): Promise<void> {
    const context = await this.getRuntimeContext();
    const requirements = context.requirements;
    if (requirements === undefined) {
      return;
    }

    if (this.requirementsPromise === null) {
      this.requirementsPromise = (async () => {
        const definitions = await this.fetchDefinitions();
        const values: Record<string, unknown> = {};
        for (const definition of definitions) {
          const evaluated = await evaluateDefinition(definition);
          values[definition.name] = parseDeclaredValue(evaluated.value, evaluated.declaredType);
        }
        await validateRequirements(requirements, values);
      })();
    }

    await this.requirementsPromise;
  }

  private async getStaticDefinition(name: string): Promise<BarekeyVariableDefinition> {
    await this.ensureRequirementsValidated();
    const context = await this.getRuntimeContext();
    const cacheKey = this.buildDefinitionCacheKey(context, name);
    const cached = this.definitionCache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const definitions = await this.fetchDefinitions([name]);
    const resolved = definitions[0];
    if (resolved === undefined) {
      throw new VariableNotFoundError();
    }
    return resolved;
  }

  private async resolveStaticValue(
    name: string,
    options?: BarekeyGetOptions,
  ): Promise<BarekeyEvaluatedValue> {
    const definition = await this.getStaticDefinition(name);
    return await evaluateDefinition(definition, options);
  }

  private async resolveDynamicValue(
    name: string,
    options?: BarekeyGetOptions,
  ): Promise<BarekeyEvaluatedValue> {
    const context = await this.getRuntimeContext();
    const cacheKey = this.buildEvaluationCacheKey(context, name, options);
    const dynamic = options?.dynamic;
    if (dynamic !== true) {
      const cached = this.evaluationCache.getRecord(cacheKey);
      if (
        cached !== null &&
        (dynamic === undefined || Date.now() - cached.storedAtMs <= dynamic.ttl)
      ) {
        return cached.value;
      }
    }

    const evaluated = await postJson<EvaluateResponse>({
      fetchFn: this.fetchFn,
      baseUrl: context.baseUrl,
      path: "/v1/env/evaluate",
      payload: {
        orgSlug: context.organization,
        projectSlug: context.project,
        stageSlug: context.environment,
        name,
        seed: options?.seed,
        key: options?.key,
      },
      auth: context.auth,
    });

    const resolved: BarekeyEvaluatedValue = {
      name: evaluated.name,
      kind: evaluated.kind,
      declaredType: evaluated.declaredType,
      value: evaluated.value,
      decision: evaluated.decision,
      selectedArm: inferSelectedArmFromDecision(evaluated.decision),
    };

    if (dynamic !== undefined && dynamic !== true) {
      // dynamic.ttl is evaluated per read, so keep the cached fetch time and let
      // later calls decide whether the entry is still fresh for their requested ttl.
      this.evaluationCache.set(cacheKey, resolved);
    }

    return resolved;
  }

  private async resolveEvaluatedValue(
    name: string,
    options?: BarekeyGetOptions,
  ): Promise<BarekeyEvaluatedValue> {
    validateDynamicOptions(options);
    if (options?.dynamic === undefined) {
      return await this.resolveStaticValue(name, options);
    }
    return await this.resolveDynamicValue(name, options);
  }
}
