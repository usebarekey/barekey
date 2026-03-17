import type { MutationCtx } from "../_generated/server";

/**
 * Normalizes a project name into the base slug stem used for allocation.
 *
 * @param name The project name to normalize.
 * @returns The normalized slug base.
 * @remarks Non-alphanumeric characters are stripped and the stem is capped to 48 characters.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export function normalizeProjectSlugBase(name: string): string {
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 48);

  return normalized.length > 0 ? normalized : "project";
}

/**
 * Generates a zero-padded random numeric suffix.
 *
 * @param length The suffix length to generate.
 * @returns The zero-padded numeric suffix string.
 * @remarks This is used during project slug collision retries.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
function randomNumericSuffix(length: number): string {
  const upperBound = 10 ** length;
  const value = Math.floor(Math.random() * upperBound);
  return String(value).padStart(length, "0");
}

/**
 * Allocates a unique project slug within an organization.
 *
 * @param ctx The Convex mutation context.
 * @param args The organization id and desired slug base.
 * @returns The allocated unique slug.
 * @remarks This retries multiple numeric suffix widths before failing.
 * @lastModified 2026-03-17
 * @author GPT-5.4
 */
export async function allocateUniqueProjectSlug(
  ctx: MutationCtx,
  args: { orgId: string; slugBase: string },
): Promise<string> {
  for (const suffixLength of [4, 6] as const) {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const candidate = `${args.slugBase}-${randomNumericSuffix(suffixLength)}`;
      const existing = await ctx.db
        .query("projects")
        .withIndex("by_org_id_and_slug", (q) => q.eq("orgId", args.orgId).eq("slug", candidate))
        .unique();

      if (existing === null) {
        return candidate;
      }
    }
  }

  throw new Error("Unable to allocate a unique project slug.");
}
