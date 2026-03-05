import type {
  BarekeyCacheAdapter,
  BarekeyCacheRecord,
  BarekeyGetOptions,
} from "../types";

const NO_EXPIRY_MS = Number.MAX_SAFE_INTEGER;

export type BarekeyCachePolicy = {
  readEnabled: boolean;
  writeEnabled: boolean;
  ttlMs: number;
};

export class InMemoryCacheAdapter implements BarekeyCacheAdapter {
  private readonly store = new Map<string, BarekeyCacheRecord>();

  async get(key: string): Promise<BarekeyCacheRecord | null> {
    const record = this.store.get(key) ?? null;
    if (record === null) {
      return null;
    }
    if (record.expiresAtMs <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return record;
  }

  async set(key: string, value: BarekeyCacheRecord): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export function resolveCachePolicy(options?: BarekeyGetOptions): BarekeyCachePolicy {
  // Default behavior: cache all evaluations for process lifetime.
  if (options?.dynamic === undefined) {
    return {
      readEnabled: true,
      writeEnabled: true,
      ttlMs: NO_EXPIRY_MS,
    };
  }

  // Dynamic mode defaults to bypass cache unless explicit TTL is provided.
  const ttl = options.dynamic.ttl;
  if (ttl === undefined) {
    return {
      readEnabled: false,
      writeEnabled: false,
      ttlMs: 0,
    };
  }

  if (!Number.isFinite(ttl) || ttl <= 0) {
    return {
      readEnabled: false,
      writeEnabled: false,
      ttlMs: 0,
    };
  }

  return {
    readEnabled: true,
    writeEnabled: true,
    ttlMs: ttl,
  };
}

export function toCacheKey(input: {
  orgSlug: string;
  projectSlug: string;
  stageSlug: string;
  name: string;
  seed: string;
  key: string;
}): string {
  return `${input.orgSlug}|${input.projectSlug}|${input.stageSlug}|${input.name}|${input.seed}|${input.key}`;
}
