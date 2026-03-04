import { v } from "convex/values";

import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { getOrgClaimsFromIdentity, requireIdentity } from "./lib/auth";

const RESERVED_USER_SLUG_BASES = new Set([
  "auth",
  "api",
  "o",
  "u",
  "orgs",
  "new",
  "select",
  "settings",
  "me",
  "@",
]);

function normalizeSlugBaseFromText(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
  if (normalized.length === 0) {
    return "user";
  }

  if (RESERVED_USER_SLUG_BASES.has(normalized)) {
    return `${normalized}user`.slice(0, 20);
  }

  return normalized;
}

function deriveUserSlugBase(email: string | undefined, name: string | undefined): string {
  const emailLocalPart = email?.split("@")[0];
  if (emailLocalPart && emailLocalPart.length > 0) {
    return normalizeSlugBaseFromText(emailLocalPart);
  }

  if (name && name.length > 0) {
    return normalizeSlugBaseFromText(name);
  }

  return "user";
}

function randomNumericSuffix(length: number): string {
  const upperBound = 10 ** length;
  const value = Math.floor(Math.random() * upperBound);
  return String(value).padStart(length, "0");
}

const userRecordFields = {
  clerkUserId: v.string(),
  slug: v.string(),
  slugBase: v.string(),
  email: v.union(v.string(), v.null()),
  displayName: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
};

const userRecordValidator = v.object(userRecordFields);

const userAccountRecordValidator = v.object({
  ...userRecordFields,
  createdAtMs: v.number(),
  updatedAtMs: v.number(),
  lastSeenAtMs: v.number(),
});

const currentUserFreePlanCreditValidator = v.object({
  totalCredits: v.number(),
  remainingCredits: v.number(),
  assignedOrgId: v.union(v.string(), v.null()),
  assignedOrgSlug: v.union(v.string(), v.null()),
});

export const ensureCurrentUser = mutation({
  args: {},
  returns: userRecordValidator,
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const orgClaims = getOrgClaimsFromIdentity(identity);
    const now = Date.now();
    const clerkUserId = identity.subject;
    const email = identity.email ?? null;
    const displayName = identity.name ?? identity.nickname ?? identity.preferredUsername ?? null;
    const imageUrl = identity.pictureUrl ?? null;

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        email,
        displayName,
        imageUrl,
        updatedAtMs: now,
        lastSeenAtMs: now,
      });

      await ctx.runMutation(internal.payments.ensureFreePlanCreditForClerkUserInternal, {
        clerkUserId,
        orgId: orgClaims.orgId,
        orgSlug: orgClaims.orgSlug,
        consumeForOrgIfAvailable: true,
      });

      return {
        clerkUserId: existingUser.clerkUserId,
        slug: existingUser.slug,
        slugBase: existingUser.slugBase,
        email,
        displayName,
        imageUrl,
      };
    }

    const slugBase = deriveUserSlugBase(identity.email, identity.name ?? identity.nickname);
    let slug: string | null = null;
    for (const suffixLength of [4, 6] as const) {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = `${slugBase}-${randomNumericSuffix(suffixLength)}`;
        const collision = await ctx.db
          .query("users")
          .withIndex("by_slug", (q) => q.eq("slug", candidate))
          .unique();
        if (collision === null) {
          slug = candidate;
          break;
        }
      }

      if (slug !== null) {
        break;
      }
    }

    if (slug === null) {
      throw new Error("Unable to allocate a unique user slug.");
    }

    await ctx.db.insert("users", {
      clerkUserId,
      slug,
      slugBase,
      email,
      displayName,
      imageUrl,
      createdAtMs: now,
      updatedAtMs: now,
      lastSeenAtMs: now,
    });

    await ctx.runMutation(internal.payments.ensureFreePlanCreditForClerkUserInternal, {
      clerkUserId,
      orgId: orgClaims.orgId,
      orgSlug: orgClaims.orgSlug,
      consumeForOrgIfAvailable: true,
    });

    return {
      clerkUserId,
      slug,
      slugBase,
      email,
      displayName,
      imageUrl,
    };
  },
});

export const getCurrentUser = query({
  args: {},
  returns: v.union(userRecordValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    if (user === null) {
      return null;
    }

    return {
      clerkUserId: user.clerkUserId,
      slug: user.slug,
      slugBase: user.slugBase,
      email: user.email,
      displayName: user.displayName,
      imageUrl: user.imageUrl,
    };
  },
});

/**
 * Returns the current user's account record with lifecycle timestamps for timeline views.
 */
export const getCurrentUserAccount = query({
  args: {},
  returns: v.union(userAccountRecordValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    if (user === null) {
      return null;
    }

    return {
      clerkUserId: user.clerkUserId,
      slug: user.slug,
      slugBase: user.slugBase,
      email: user.email,
      displayName: user.displayName,
      imageUrl: user.imageUrl,
      createdAtMs: user.createdAtMs,
      updatedAtMs: user.updatedAtMs,
      lastSeenAtMs: user.lastSeenAtMs,
    };
  },
});

export const getBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: v.union(
    v.object({
      clerkUserId: v.string(),
      slug: v.string(),
      displayName: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (user === null) {
      return null;
    }

    return {
      clerkUserId: user.clerkUserId,
      slug: user.slug,
      displayName: user.displayName,
    };
  },
});

/**
 * Returns the current user's free workspace credit status and assignment.
 */
export const getCurrentUserFreePlanCredit = query({
  args: {},
  returns: currentUserFreePlanCreditValidator,
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const credit = await ctx.db
      .query("userFreePlanCredits")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", identity.subject))
      .unique();

    if (credit === null) {
      return {
        totalCredits: 1,
        remainingCredits: 1,
        assignedOrgId: null,
        assignedOrgSlug: null,
      };
    }

    return {
      totalCredits: credit.totalCredits,
      remainingCredits: credit.remainingCredits,
      assignedOrgId: credit.assignedOrgId,
      assignedOrgSlug: credit.assignedOrgSlug,
    };
  },
});
