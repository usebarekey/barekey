import { runtimeConfig } from "./config";

export default {
  /**
   * Proxies every request to the Convex HTTP origin so Cloudflare owns the
   * public edge entrypoint instead of a Vercel redirect layer.
   */
  async fetch(request: Request): Promise<Response> {
    const incomingUrl = new URL(request.url);
    const upstreamUrl = new URL(
      incomingUrl.pathname + incomingUrl.search,
      runtimeConfig.convexHttpOrigin,
    );
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
