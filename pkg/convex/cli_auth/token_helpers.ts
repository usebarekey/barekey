export const DEVICE_CODE_BYTES = 32;
export const TOKEN_BYTES = 32;
export const DEFAULT_DEVICE_INTERVAL_SEC = 5;
export const DEFAULT_DEVICE_EXPIRES_IN_SEC = 600;
export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const USER_CODE_LENGTH = 8;

/**
 * Encodes bytes into URL-safe base64 without padding.
 *
 * @param bytes The byte array to encode.
 * @returns The URL-safe base64 representation.
 * @remarks This is used for CLI device codes, access tokens, refresh tokens, and token hashes.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Creates a random URL-safe token with a fixed prefix.
 *
 * @param prefix The token prefix to prepend.
 * @param byteLength The number of random bytes to generate before encoding.
 * @returns The prefixed URL-safe token string.
 * @remarks This uses `crypto.getRandomValues` and is suitable for device/session tokens.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function randomToken(prefix: string, byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return `${prefix}${bytesToBase64Url(bytes)}`;
}

/**
 * Creates a human-enterable CLI user code.
 *
 * @returns The generated user code.
 * @remarks Ambiguous characters are intentionally excluded to reduce copy mistakes in device auth flows.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function randomUserCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(USER_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let result = "";
  for (let index = 0; index < USER_CODE_LENGTH; index += 1) {
    const value = bytes[index] ?? 0;
    result += alphabet[value % alphabet.length] ?? "A";
  }
  return result;
}

/**
 * Hashes a token into URL-safe base64 SHA-256 form.
 *
 * @param input The token to hash.
 * @returns The SHA-256 hash encoded as URL-safe base64.
 * @remarks Stored CLI device/session records keep token hashes rather than raw secret values.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bytesToBase64Url(new Uint8Array(digest));
}
