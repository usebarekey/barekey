interface Env {
  CONVEX_HTTP_ORIGIN?: string;
}

const DEFAULT_CONVEX_HTTP_ORIGIN = "https://chatty-sparrow-921.convex.site";

function getUpstreamOrigin(env: Env): string {
  return env.CONVEX_HTTP_ORIGIN ?? DEFAULT_CONVEX_HTTP_ORIGIN;
}

export default {
  /**
   * Proxies every request to the Convex HTTP origin so Cloudflare owns the
   * public edge entrypoint instead of a Vercel redirect layer.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const incomingUrl = new URL(request.url);
    const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, getUpstreamOrigin(env));
    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", incomingUrl.host);
    headers.set("x-forwarded-proto", incomingUrl.protocol.replace(/:$/, ""));

    return fetch(
      new Request(upstreamUrl, {
        method: request.method,
        headers,
        body: request.body,
        redirect: request.redirect,
      }),
    );
  },
};
