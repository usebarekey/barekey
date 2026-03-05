export type BarekeyResolvedKind = "secret" | "ab_roll" | "rollout";

export type BarekeyResolvedValue = {
  name: string;
  kind: BarekeyResolvedKind;
  value: string;
  decision?: {
    bucket?: number;
    chance?: number;
    seed?: string;
    key?: string;
    matchedRule?: string;
  };
};

export type BarekeyErrorCode =
  | "UNAUTHORIZED"
  | "ORG_SCOPE_INVALID"
  | "VARIABLE_NOT_FOUND"
  | "INVALID_REQUEST"
  | "BILLING_UNAVAILABLE"
  | "USAGE_LIMIT_EXCEEDED"
  | "NETWORK_ERROR"
  | "COERCE_FAILED"
  | "REQUIRED_VALUE_MISSING"
  | "EVALUATION_FAILED"
  | "UNKNOWN_ERROR";

export class BarekeyError extends Error {
  readonly code: BarekeyErrorCode;
  readonly requestId: string | null;
  readonly status: number | null;

  constructor(input: {
    code: BarekeyErrorCode;
    message: string;
    requestId?: string | null;
    status?: number | null;
  }) {
    super(input.message);
    this.name = "BarekeyError";
    this.code = input.code;
    this.requestId = input.requestId ?? null;
    this.status = input.status ?? null;
  }
}

export type BarekeyAuthProvider = {
  getAccessToken(): Promise<string>;
  onAuthError?(error: BarekeyError): Promise<void>;
};

export type BarekeyGetOptions = {
  dynamic?: {
    ttl?: number;
  };
  seed?: string;
  key?: string;
};

export type BarekeyClientOptions = {
  baseUrl: string;
  auth: BarekeyAuthProvider;
  projectSlug: string;
  stageSlug: string;
  orgSlug?: string;
  cache?: BarekeyCacheAdapter;
  fetch?: typeof globalThis.fetch;
};

type BarekeyEvaluateSingleResponse = {
  name: string;
  kind: BarekeyResolvedKind;
  value: string;
  decision?: BarekeyResolvedValue["decision"];
};

type BarekeyEvaluateBatchResponse = {
  values: Array<BarekeyEvaluateSingleResponse>;
};

type BarekeyApiErrorResponse = {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
};

export type BarekeyCacheRecord = {
  value: BarekeyResolvedValue;
  expiresAtMs: number;
};

export type BarekeyCacheAdapter = {
  get(key: string): Promise<BarekeyCacheRecord | null>;
  set(key: string, value: BarekeyCacheRecord): Promise<void>;
  delete(key: string): Promise<void>;
};

class InMemoryCacheAdapter implements BarekeyCacheAdapter {
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

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeErrorCode(code: string): BarekeyErrorCode {
  if (
    code === "UNAUTHORIZED" ||
    code === "ORG_SCOPE_INVALID" ||
    code === "VARIABLE_NOT_FOUND" ||
    code === "INVALID_REQUEST" ||
    code === "BILLING_UNAVAILABLE" ||
    code === "USAGE_LIMIT_EXCEEDED" ||
    code === "EVALUATION_FAILED"
  ) {
    return code;
  }
  return "UNKNOWN_ERROR";
}

function parseNumberOrThrow(value: string): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new BarekeyError({
      code: "COERCE_FAILED",
      message: `Unable to coerce value to number: ${value}`,
    });
  }
  return parsed;
}

function parseBooleanOrThrow(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  throw new BarekeyError({
    code: "COERCE_FAILED",
    message: `Unable to coerce value to boolean: ${value}`,
  });
}

export class BarekeyValueBuilder<TValue> {
  private readonly resolve: () => Promise<BarekeyResolvedValue>;

  constructor(resolve: () => Promise<BarekeyResolvedValue>) {
    this.resolve = resolve;
  }

  async raw(): Promise<BarekeyResolvedValue> {
    return this.resolve();
  }

  async string(): Promise<string> {
    const resolved = await this.resolve();
    return resolved.value;
  }

  async number(): Promise<number> {
    const resolved = await this.resolve();
    return parseNumberOrThrow(resolved.value);
  }

  async boolean(): Promise<boolean> {
    const resolved = await this.resolve();
    return parseBooleanOrThrow(resolved.value);
  }

  async json<TJson = TValue>(): Promise<TJson> {
    const resolved = await this.resolve();
    try {
      return JSON.parse(resolved.value) as TJson;
    } catch {
      throw new BarekeyError({
        code: "COERCE_FAILED",
        message: `Unable to parse JSON value for ${resolved.name}.`,
      });
    }
  }

  async default<TDefault>(fallback: TDefault): Promise<string | TDefault> {
    try {
      return await this.string();
    } catch {
      return fallback;
    }
  }

  async required(message?: string): Promise<string> {
    try {
      const value = await this.string();
      if (value.length === 0) {
        throw new BarekeyError({
          code: "REQUIRED_VALUE_MISSING",
          message: message ?? "Required value is empty.",
        });
      }
      return value;
    } catch (error: unknown) {
      if (error instanceof BarekeyError) {
        throw error;
      }
      throw new BarekeyError({
        code: "REQUIRED_VALUE_MISSING",
        message: message ?? "Required value is missing.",
      });
    }
  }
}

export type BarekeyClient = {
  get(name: string, options?: BarekeyGetOptions): BarekeyValueBuilder<string>;
  evaluate(name: string, options?: BarekeyGetOptions): Promise<BarekeyResolvedValue>;
  getMany(
    names: Array<string>,
    options?: BarekeyGetOptions,
  ): Promise<Record<string, BarekeyResolvedValue>>;
  evaluateMany(
    names: Array<string>,
    options?: BarekeyGetOptions,
  ): Promise<Array<BarekeyResolvedValue>>;
};

async function fetchWithAuth(input: {
  fetchFn: typeof globalThis.fetch;
  auth: BarekeyAuthProvider;
  baseUrl: string;
  path: string;
  payload: unknown;
}): Promise<unknown> {
  const makeRequest = async (token: string): Promise<Response> =>
    input.fetchFn(`${input.baseUrl}${input.path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input.payload),
    });

  const accessToken = await input.auth.getAccessToken();
  let response: Response;
  try {
    response = await makeRequest(accessToken);
  } catch (error: unknown) {
    throw new BarekeyError({
      code: "NETWORK_ERROR",
      message: error instanceof Error ? error.message : "Network request failed.",
    });
  }

  if (response.status === 401 && input.auth.onAuthError) {
    await input.auth.onAuthError(
      new BarekeyError({
        code: "UNAUTHORIZED",
        message: "Access token was rejected.",
        status: 401,
      }),
    );
    const retryToken = await input.auth.getAccessToken();
    response = await makeRequest(retryToken);
  }

  const parsed = await parseJsonResponse(response);
  if (!response.ok) {
    const parsedError = parsed as BarekeyApiErrorResponse | null;
    const message = parsedError?.error?.message ?? `Request failed with status ${response.status}.`;
    const code = normalizeErrorCode(parsedError?.error?.code ?? "UNKNOWN_ERROR");
    const requestId = parsedError?.error?.requestId ?? null;
    throw new BarekeyError({
      code,
      message,
      requestId,
      status: response.status,
    });
  }

  return parsed;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

function toCacheKey(input: {
  orgSlug: string;
  projectSlug: string;
  stageSlug: string;
  name: string;
  seed: string;
  key: string;
}): string {
  return `${input.orgSlug}|${input.projectSlug}|${input.stageSlug}|${input.name}|${input.seed}|${input.key}`;
}

export function createBarekeyClient(options: BarekeyClientOptions): BarekeyClient {
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  const cache = options.cache ?? new InMemoryCacheAdapter();
  const baseUrl = normalizeBaseUrl(options.baseUrl);

  async function evaluate(
    name: string,
    inputOptions?: BarekeyGetOptions,
  ): Promise<BarekeyResolvedValue> {
    const ttl = inputOptions?.dynamic?.ttl ?? 0;
    const seed = inputOptions?.seed ?? "";
    const key = inputOptions?.key ?? "";
    const cacheKey = toCacheKey({
      orgSlug: options.orgSlug ?? "",
      projectSlug: options.projectSlug,
      stageSlug: options.stageSlug,
      name,
      seed,
      key,
    });

    if (ttl > 0) {
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        return cached.value;
      }
    }

    const parsed = (await fetchWithAuth({
      fetchFn,
      auth: options.auth,
      baseUrl,
      path: "/v1/env/evaluate",
      payload: {
        projectSlug: options.projectSlug,
        stageSlug: options.stageSlug,
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

    if (ttl > 0) {
      await cache.set(cacheKey, {
        value: resolved,
        expiresAtMs: Date.now() + ttl,
      });
    }

    return resolved;
  }

  async function evaluateMany(
    names: Array<string>,
    inputOptions?: BarekeyGetOptions,
  ): Promise<Array<BarekeyResolvedValue>> {
    const parsed = (await fetchWithAuth({
      fetchFn,
      auth: options.auth,
      baseUrl,
      path: "/v1/env/evaluate-batch",
      payload: {
        projectSlug: options.projectSlug,
        stageSlug: options.stageSlug,
        names,
        seed: inputOptions?.seed,
        key: inputOptions?.key,
      },
    })) as BarekeyEvaluateBatchResponse;

    return parsed.values.map((row) => ({
      name: row.name,
      kind: row.kind,
      value: row.value,
      decision: row.decision,
    }));
  }

  return {
    get(name: string, inputOptions?: BarekeyGetOptions): BarekeyValueBuilder<string> {
      return new BarekeyValueBuilder<string>(() => evaluate(name, inputOptions));
    },
    evaluate,
    async getMany(
      names: Array<string>,
      inputOptions?: BarekeyGetOptions,
    ): Promise<Record<string, BarekeyResolvedValue>> {
      const resolved = await evaluateMany(names, inputOptions);
      const byName: Record<string, BarekeyResolvedValue> = {};
      for (const row of resolved) {
        byName[row.name] = row;
      }
      return byName;
    },
    evaluateMany,
  };
}

let singletonClient: BarekeyClient | null = null;

export function initEnv(options: BarekeyClientOptions): BarekeyClient {
  singletonClient = createBarekeyClient(options);
  return singletonClient;
}

export const env: BarekeyClient = {
  get(name: string, options?: BarekeyGetOptions): BarekeyValueBuilder<string> {
    if (singletonClient === null) {
      throw new BarekeyError({
        code: "INVALID_REQUEST",
        message: "env singleton is not initialized. Call initEnv() first.",
      });
    }
    return singletonClient.get(name, options);
  },
  async evaluate(name: string, options?: BarekeyGetOptions): Promise<BarekeyResolvedValue> {
    if (singletonClient === null) {
      throw new BarekeyError({
        code: "INVALID_REQUEST",
        message: "env singleton is not initialized. Call initEnv() first.",
      });
    }
    return singletonClient.evaluate(name, options);
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
  async evaluateMany(
    names: Array<string>,
    options?: BarekeyGetOptions,
  ): Promise<Array<BarekeyResolvedValue>> {
    if (singletonClient === null) {
      throw new BarekeyError({
        code: "INVALID_REQUEST",
        message: "env singleton is not initialized. Call initEnv() first.",
      });
    }
    return singletonClient.evaluateMany(names, options);
  },
};
