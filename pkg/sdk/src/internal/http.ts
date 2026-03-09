import { NetworkError, UnauthorizedError, createBarekeyErrorFromCode } from "../errors.js";

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
} | null;

export type InternalAuthResolver = {
  getAccessToken(): Promise<string>;
  onUnauthorized?(): Promise<void>;
};

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

export async function postJson<TResponse>(input: {
  fetchFn: typeof globalThis.fetch;
  baseUrl: string;
  path: string;
  payload: unknown;
  auth?: InternalAuthResolver;
}): Promise<TResponse> {
  const makeRequest = async (accessToken?: string): Promise<Response> =>
    input.fetchFn(`${normalizeBaseUrl(input.baseUrl)}${input.path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(accessToken
          ? {
              authorization: `Bearer ${accessToken}`,
            }
          : {}),
      },
      body: JSON.stringify(input.payload),
    });

  let response: Response;
  let accessToken: string | undefined;
  try {
    accessToken = input.auth ? await input.auth.getAccessToken() : undefined;
    response = await makeRequest(accessToken);
  } catch (error: unknown) {
    throw new NetworkError({
      message: error instanceof Error ? error.message : "A Barekey network request failed.",
      cause: error,
    });
  }

  if (response.status === 401 && input.auth?.onUnauthorized) {
    await input.auth.onUnauthorized();
    try {
      response = await makeRequest(await input.auth.getAccessToken());
    } catch (error: unknown) {
      throw new NetworkError({
        message: error instanceof Error ? error.message : "A Barekey network request failed.",
        cause: error,
      });
    }
  }

  const parsed = (await parseJsonResponse(response)) as ApiErrorPayload | TResponse;
  if (!response.ok) {
    const parsedError = parsed as ApiErrorPayload;
    const code =
      parsedError?.error?.code ?? (response.status === 401 ? "UNAUTHORIZED" : "UNKNOWN_ERROR");
    const message =
      parsedError?.error?.message ??
      (response.status === 401
        ? "The provided Barekey credentials were rejected."
        : `Barekey request failed with status ${response.status}.`);

    if (response.status === 401 && code === "UNAUTHORIZED" && !parsedError?.error?.message) {
      throw new UnauthorizedError({
        requestId: parsedError?.error?.requestId ?? null,
        status: response.status,
      });
    }

    throw createBarekeyErrorFromCode({
      code,
      message,
      requestId: parsedError?.error?.requestId ?? null,
      status: response.status,
    });
  }

  return parsed as TResponse;
}
