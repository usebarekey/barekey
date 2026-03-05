export function extractRequestId(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }
  const match = error.message.match(/Request ID:\s*([A-Za-z0-9-]+)/i);
  return match?.[1] ?? null;
}

export function formatSupportErrorMessage(context: string, requestId: string | null): string {
  if (requestId) {
    return `${context} If the issue persists, contact support and include Request ID: ${requestId}.`;
  }
  return `${context} If the issue persists, contact support.`;
}
