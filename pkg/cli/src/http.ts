export class CliHttpError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string | null;

  constructor(input: { code: string; status: number; message: string; requestId?: string | null }) {
    super(input.message);
    this.name = "CliHttpError";
    this.code = input.code;
    this.status = input.status;
    this.requestId = input.requestId ?? null;
  }
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function postJson<TResponse>(input: {
  baseUrl: string;
  path: string;
  payload: unknown;
  accessToken?: string | null;
}): Promise<TResponse> {
  const response = await fetch(`${input.baseUrl.replace(/\/$/, "")}${input.path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(input.accessToken
        ? {
            authorization: `Bearer ${input.accessToken}`,
          }
        : {}),
    },
    body: JSON.stringify(input.payload),
  });

  const parsed = await parseJson(response);
  if (!response.ok) {
    const payload = parsed as {
      error?: { code?: string; message?: string; requestId?: string };
    } | null;
    throw new CliHttpError({
      code: payload?.error?.code ?? "HTTP_ERROR",
      status: response.status,
      message: payload?.error?.message ?? `HTTP ${response.status}`,
      requestId: payload?.error?.requestId ?? null,
    });
  }

  return parsed as TResponse;
}

export async function getJson<TResponse>(input: {
  baseUrl: string;
  path: string;
  accessToken?: string | null;
}): Promise<TResponse> {
  const response = await fetch(`${input.baseUrl.replace(/\/$/, "")}${input.path}`, {
    method: "GET",
    headers: input.accessToken
      ? {
          authorization: `Bearer ${input.accessToken}`,
        }
      : undefined,
  });

  const parsed = await parseJson(response);
  if (!response.ok) {
    const payload = parsed as {
      error?: { code?: string; message?: string; requestId?: string };
    } | null;
    throw new CliHttpError({
      code: payload?.error?.code ?? "HTTP_ERROR",
      status: response.status,
      message: payload?.error?.message ?? `HTTP ${response.status}`,
      requestId: payload?.error?.requestId ?? null,
    });
  }

  return parsed as TResponse;
}
