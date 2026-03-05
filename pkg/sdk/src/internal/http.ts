import { BarekeyError, normalizeErrorCode } from "../errors";
import type {
  BarekeyApiErrorResponse,
  BarekeyAuthProvider,
} from "../types";

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

export async function fetchWithAuth(input: {
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
