import {
  InMemoryCacheAdapter,
  resolveCachePolicy,
  toCacheKey,
} from "./internal/cache";
import { fetchWithAuth, normalizeBaseUrl } from "./internal/http";
import type {
  BarekeyCacheAdapter,
  BarekeyClientOptions,
  BarekeyEvaluateBatchResponse,
  BarekeyEvaluateSingleResponse,
  BarekeyGetOptions,
  BarekeyResolvedValue,
} from "./types";
import { BarekeyValueBuilder } from "./value-builder";

export class BarekeyClient {
  private readonly options: BarekeyClientOptions;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly baseUrl: string;
  private readonly cache: BarekeyCacheAdapter;

  constructor(options: BarekeyClientOptions) {
    this.options = options;
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.cache = options.cache ?? new InMemoryCacheAdapter();
  }

  private buildCacheKey(name: string, inputOptions?: BarekeyGetOptions): string {
    return toCacheKey({
      orgSlug: this.options.orgSlug ?? "",
      projectSlug: this.options.projectSlug,
      stageSlug: this.options.stageSlug,
      name,
      seed: inputOptions?.seed ?? "",
      key: inputOptions?.key ?? "",
    });
  }

  private async evaluate(name: string, inputOptions?: BarekeyGetOptions): Promise<BarekeyResolvedValue> {
    const cachePolicy = resolveCachePolicy(inputOptions);
    const cacheKey = this.buildCacheKey(name, inputOptions);

    if (cachePolicy.readEnabled) {
      const cached = await this.cache.get(cacheKey);
      if (cached !== null) {
        return cached.value;
      }
    }

    const parsed = (await fetchWithAuth({
      fetchFn: this.fetchFn,
      auth: this.options.auth,
      baseUrl: this.baseUrl,
      path: "/v1/env/evaluate",
      payload: {
        projectSlug: this.options.projectSlug,
        stageSlug: this.options.stageSlug,
        name,
        seed: inputOptions?.seed,
        key: inputOptions?.key,
      },
    })) as BarekeyEvaluateSingleResponse;

    const resolved: BarekeyResolvedValue = {
      name: parsed.name,
      kind: parsed.kind,
      value: parsed.value,
      decision: parsed.decision,
    };

    if (cachePolicy.writeEnabled) {
      await this.cache.set(cacheKey, {
        value: resolved,
        expiresAtMs: Date.now() + cachePolicy.ttlMs,
      });
    }

    return resolved;
  }

  private async evaluateMany(
    names: Array<string>,
    inputOptions?: BarekeyGetOptions,
  ): Promise<Array<BarekeyResolvedValue>> {
    if (names.length === 0) {
      return [];
    }

    const cachePolicy = resolveCachePolicy(inputOptions);
    const cachedByName = new Map<string, BarekeyResolvedValue>();
    const missingNames: Array<string> = [];

    if (cachePolicy.readEnabled) {
      for (const name of names) {
        const cached = await this.cache.get(this.buildCacheKey(name, inputOptions));
        if (cached !== null) {
          cachedByName.set(name, cached.value);
          continue;
        }
        missingNames.push(name);
      }
    } else {
      missingNames.push(...names);
    }

    if (missingNames.length > 0) {
      const parsed = (await fetchWithAuth({
        fetchFn: this.fetchFn,
        auth: this.options.auth,
        baseUrl: this.baseUrl,
        path: "/v1/env/evaluate-batch",
        payload: {
          projectSlug: this.options.projectSlug,
          stageSlug: this.options.stageSlug,
          names: missingNames,
          seed: inputOptions?.seed,
          key: inputOptions?.key,
        },
      })) as BarekeyEvaluateBatchResponse;

      for (const row of parsed.values) {
        const resolved: BarekeyResolvedValue = {
          name: row.name,
          kind: row.kind,
          value: row.value,
          decision: row.decision,
        };
        cachedByName.set(row.name, resolved);

        if (cachePolicy.writeEnabled) {
          await this.cache.set(this.buildCacheKey(row.name, inputOptions), {
            value: resolved,
            expiresAtMs: Date.now() + cachePolicy.ttlMs,
          });
        }
      }
    }

    const ordered: Array<BarekeyResolvedValue> = [];
    for (const name of names) {
      const resolved = cachedByName.get(name);
      if (resolved !== undefined) {
        ordered.push(resolved);
      }
    }

    return ordered;
  }

  get(name: string, inputOptions?: BarekeyGetOptions): BarekeyValueBuilder<string> {
    return new BarekeyValueBuilder<string>(() => this.evaluate(name, inputOptions));
  }

  async getMany(
    names: Array<string>,
    inputOptions?: BarekeyGetOptions,
  ): Promise<Record<string, BarekeyResolvedValue>> {
    const resolved = await this.evaluateMany(names, inputOptions);
    const byName: Record<string, BarekeyResolvedValue> = {};
    for (const row of resolved) {
      byName[row.name] = row;
    }
    return byName;
  }
}
