const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers":
    "authorization,content-type,x-request-id,x-barekey-request-key",
  "access-control-max-age": "86400",
} as const;

export type ErrorResponseInput = {
  status: number;
  code: string;
  message: string;
  requestId: string;
};

export function buildJsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

export function readRequestId(request: Request): string {
  const headerRequestId = request.headers.get("x-request-id");
  if (headerRequestId && headerRequestId.trim().length > 0) {
    return headerRequestId.trim();
  }
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function errorResponse(input: ErrorResponseInput): Response {
  return buildJsonResponse(input.status, {
    error: {
      code: input.code,
      message: input.message,
      requestId: input.requestId,
    },
  });
}

export function buildCorsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export function authErrorResponse(
  input: Omit<ErrorResponseInput, "requestId"> & { requestId: string },
): Response {
  return errorResponse(input);
}
